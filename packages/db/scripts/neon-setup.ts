/**
 * Prepara (ou confere) uma branch do Neon de ponta a ponta. Seguro de repetir.
 *
 *   pnpm neon:setup dev          → banco de testes; grava os .env.local
 *   pnpm neon:setup production   → banco do site no ar; grava os .env.vercel.production
 *   ... --nova-senha             → troca as senhas dos papéis (site e painel)
 *
 * Passos: tabelas (migrações) → papéis restritos loja_site (site, só leitura) e
 * loja_admin (painel), criados por SQL fora do neon_superuser → permissões →
 * catálogo inicial (sem sobrescrever edições) → teste de segurança.
 * Nenhuma senha é exibida. Segredos já existentes nos arquivos são mantidos.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { ADMIN_ROLE, SITE_ROLE, deleteApiRole, ownerUrl, parseBranch, restartCompute, type Branch } from "./lib/neon-cli";

const branch = parseBranch(process.argv[2]);
const rotate = process.argv.includes("--nova-senha");

const ROOT = resolve(import.meta.dirname, "../../..");
const PKG = resolve(import.meta.dirname, "..");
const suffix = branch === "dev" ? ".env.local" : ".env.vercel.production";
const FILES = {
  db: resolve(PKG, ".env.local"),
  site: resolve(ROOT, "apps/site", suffix),
  admin: resolve(ROOT, "apps/admin", suffix),
};

const step = (msg: string) => console.log(`• ${msg}`);
const secret = () => randomBytes(32).toString("base64url");

/* ─────────────────────────── arquivos .env ─────────────────────────── */

function readEnv(file: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(file)) return map;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"\n]*)"?$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

/** Escreve o arquivo com cabeçalho + chaves gerenciadas, preservando chaves extras já existentes. */
function writeEnv(file: string, header: string, values: [string, string][]) {
  const current = readEnv(file);
  const managed = new Set(values.map(([k]) => k));
  // A credencial de dono nunca fica nos apps (só em packages/db/.env.local).
  const forbidden = file === FILES.db ? [] : ["DATABASE_URL_MIGRATIONS"];
  const extras = [...current].filter(([k]) => !managed.has(k) && !forbidden.includes(k));
  const body =
    header +
    "\n" +
    values.map(([k, v]) => `${k}="${v}"`).join("\n") +
    (extras.length ? `\n\n# Outras variáveis (mantidas)\n${extras.map(([k, v]) => `${k}="${v}"`).join("\n")}` : "") +
    "\n";
  writeFileSync(file, body, { mode: 0o600 });
  chmodSync(file, 0o600);
}

/* ─────────────────────────────── papéis ─────────────────────────────── */

function currentRoleUrl(file: string, role: string): string | null {
  const v = readEnv(file).get("DATABASE_URL");
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.username === role && u.password ? v : null;
  } catch {
    return null;
  }
}

async function ensureRole(role: string, envFile: string, ownerDirect: string, ownerPooled: string) {
  const sql = neon(ownerDirect);
  const groups = (await sql.query(
    `select r.rolname from pg_auth_members m join pg_roles r on r.oid = m.roleid
     join pg_roles u on u.oid = m.member where u.rolname = $1`,
    [role],
  )) as { rolname: string }[];
  const exists = ((await sql.query("select 1 from pg_roles where rolname = $1", [role])) as unknown[]).length > 0;
  const unsafe = groups.length > 0;
  const current = currentRoleUrl(envFile, role);

  if (exists && !unsafe && !rotate && current) {
    step(`Papel ${role} já está restrito; senha mantida.`);
    return { url: current, recreated: false };
  }

  if (unsafe) {
    step(`Papel ${role} criado pelo Console (com acesso total) — removendo.`);
    if (!deleteApiRole(branch, role)) await sql.query(`drop role if exists ${role}`);
  } else if (exists) {
    await sql.query(`drop owned by ${role}`);
    await sql.query(`drop role ${role}`);
  }

  const password = randomBytes(24).toString("base64url"); // só [A-Za-z0-9_-]: seguro no SQL
  await sql.query(`create role ${role} with login password '${password}' nosuperuser nocreatedb nocreaterole`);
  step(`Papel ${role} criado por SQL, sem privilégios de administrador.`);

  const u = new URL(ownerPooled);
  u.username = role;
  u.password = password;
  return { url: u.toString(), recreated: true };
}

async function applyGrants(file: string, ownerDirect: string) {
  const statements = readFileSync(resolve(PKG, "roles", file), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
  const sql = neon(ownerDirect);
  for (const st of statements) await sql.query(st);
}

function run(cmd: string, args: string[], ownerDirect: string) {
  try {
    return execFileSync(cmd, args, {
      cwd: PKG,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, DATABASE_URL_MIGRATIONS: ownerDirect },
    });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    const out = `${err.stdout ?? ""}\n${err.stderr ?? ""}`.replace(/postgres(ql)?:\/\/\S+/g, "<url oculta>");
    throw new Error(`${args.join(" ")} falhou:\n${out.trim().split("\n").slice(-6).join("\n")}`);
  }
}

/* ──────────────────────────── verificação ──────────────────────────── */

async function verify(label: string, url: string, checks: [string, string, boolean][]) {
  const sql = neon(url);
  console.log(`\nTeste de segurança (${label}):`);
  let all = true;
  for (const [desc, q, allowed] of checks) {
    let ok: boolean;
    try {
      await sql.query(q);
      ok = allowed;
    } catch (e) {
      ok = !allowed && /permission denied/.test((e as Error).message);
    }
    console.log(`  ${ok ? "✓" : "✗ FALHOU"} ${desc}`);
    all &&= ok;
  }
  return all;
}

const SITE_CHECKS: [string, string, boolean][] = [
  ["site lê o catálogo", "select slug from products limit 1", true],
  ["site NÃO lê a referência interna", "select internal_reference from fragrances limit 1", false],
  ["site NÃO altera preços", "update product_variants set price_cents = price_cents where false", false],
  ["site NÃO apaga produtos", "delete from products where false", false],
  ["site NÃO cria tabelas", "create table _teste (id int)", false],
  ["site NÃO lê usuários do painel", "select email from admin_user limit 1", false],
  ["site NÃO lê senhas do painel", "select password from admin_account limit 1", false],
  ["site NÃO lê pedidos", "select customer_email from orders limit 1", false],
];

const ADMIN_CHECKS: [string, string, boolean][] = [
  ["painel lê o catálogo", "select internal_reference from fragrances limit 1", true],
  ["painel altera preços", "update product_variants set price_cents = price_cents where false", true],
  ["painel grava histórico", "select 1 from audit_log limit 1", true],
  ["painel NÃO apaga o histórico", "delete from audit_log where false", false],
  ["painel NÃO edita o histórico", "update audit_log set summary = summary where false", false],
  ["painel NÃO cria pedidos", "insert into orders (code, customer_name, customer_email, subtotal_cents, total_cents) select 'x','x','x',0,0 where false", false],
  ["painel NÃO altera valor de pedidos", "update orders set total_cents = total_cents where false", false],
  ["painel NÃO apaga pedidos", "delete from orders where false", false],
  ["painel NÃO cria tabelas", "create table _teste (id int)", false],
];

/* ──────────────────────────────── main ──────────────────────────────── */

async function main() {
  console.log(`\nPreparando branch "${branch}" do Neon\n`);
  const ownerDirect = ownerUrl(branch as Branch);
  const ownerPooled = ownerUrl(branch as Branch, true);

  run("pnpm", ["exec", "drizzle-kit", "migrate"], ownerDirect);
  step("Tabelas atualizadas (migrações).");

  const site = await ensureRole(SITE_ROLE, FILES.site, ownerDirect, ownerPooled);
  const admin = await ensureRole(ADMIN_ROLE, FILES.admin, ownerDirect, ownerPooled);
  await applyGrants("site.sql", ownerDirect);
  await applyGrants("admin.sql", ownerDirect);
  step("Permissões aplicadas.");

  const seedOut = run("pnpm", ["exec", "tsx", "scripts/seed.ts"], ownerDirect);
  step(seedOut.trim().split("\n").pop() ?? "Catálogo conferido.");

  if (site.recreated || admin.recreated) {
    restartCompute(branch);
    step("Compute reiniciado para limpar conexões antigas.");
    await new Promise((r) => setTimeout(r, 6000));
  }

  // Segredo compartilhado site ↔ painel para o painel pedir "atualize o catálogo agora".
  const siteEnv = readEnv(FILES.site);
  const adminEnv = readEnv(FILES.admin);
  const revalidate = (!rotate && (siteEnv.get("REVALIDATE_SECRET") || adminEnv.get("REVALIDATE_SECRET"))) || secret();
  const authSecret = (!rotate && adminEnv.get("BETTER_AUTH_SECRET")) || secret();

  if (branch === "dev") {
    writeEnv(FILES.db, `# Gerado por "pnpm neon:setup dev" — dono do schema (migrações, seed). NUNCA commitar.`, [
      ["DATABASE_URL_MIGRATIONS", ownerDirect],
    ]);
    writeEnv(FILES.site, `# Gerado por "pnpm neon:setup dev" — branch dev (testes). NUNCA commitar.`, [
      ["DATABASE_URL", site.url],
      ["NEXT_PUBLIC_SITE_URL", siteEnv.get("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000"],
      ["NEXT_PUBLIC_SITE_INDEXABLE", "false"],
      ["REVALIDATE_SECRET", revalidate],
    ]);
    writeEnv(FILES.admin, `# Gerado por "pnpm neon:setup dev" — painel, branch dev (testes). NUNCA commitar.`, [
      ["DATABASE_URL", admin.url],
      ["BETTER_AUTH_SECRET", authSecret],
      ["BETTER_AUTH_URL", adminEnv.get("BETTER_AUTH_URL") ?? "http://localhost:3001"],
      ["SITE_URL", adminEnv.get("SITE_URL") ?? "http://localhost:3000"],
      ["REVALIDATE_SECRET", revalidate],
    ]);
  } else {
    const note = `# Copie para Vercel → Settings → Environment Variables (ambiente Production) e apague o arquivo.`;
    writeEnv(FILES.site, `# Gerado por "pnpm neon:setup production" — SITE no ar. NUNCA commitar.\n${note}`, [
      ["DATABASE_URL", site.url],
      ["REVALIDATE_SECRET", revalidate],
    ]);
    writeEnv(FILES.admin, `# Gerado por "pnpm neon:setup production" — PAINEL no ar. NUNCA commitar.\n${note}`, [
      ["DATABASE_URL", admin.url],
      ["BETTER_AUTH_SECRET", authSecret],
      ["BETTER_AUTH_URL", adminEnv.get("BETTER_AUTH_URL") ?? "https://<endereço-do-painel>.vercel.app"],
      ["SITE_URL", adminEnv.get("SITE_URL") ?? "https://<endereco-do-site>"],
      ["REVALIDATE_SECRET", revalidate],
    ]);
  }
  step(`Credenciais gravadas (${suffix}, permissão 600, fora do git).`);

  const ok = (await verify("conexão do site", site.url, SITE_CHECKS)) && (await verify("conexão do painel", admin.url, ADMIN_CHECKS));
  console.log(ok ? `\nPronto: branch "${branch}" configurada e segura.\n` : "\nATENÇÃO: algum teste falhou. Não publique antes de revisar.\n");
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(`\nErro: ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
