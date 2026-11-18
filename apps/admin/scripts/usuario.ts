/**
 * Gerencia quem pode entrar no painel. Não existe cadastro pelo site:
 * contas só são criadas por aqui, por quem tem acesso ao repositório e ao banco.
 *
 *   pnpm admin:usuario listar        [dev|production]
 *   pnpm admin:usuario criar         [dev|production] "Nome" email@exemplo.com [dona|admin]
 *   pnpm admin:usuario trocar-email  [dev|production] atual@exemplo.com novo@exemplo.com
 *   pnpm admin:usuario nova-senha    [dev|production] email@exemplo.com
 *   pnpm admin:usuario resetar-2fa   [dev|production] email@exemplo.com
 *   pnpm admin:usuario remover       [dev|production] email@exemplo.com
 *
 * "criar" e "nova-senha" geram uma senha provisória forte, exibida UMA vez.
 * No primeiro acesso a pessoa configura o 2FA (obrigatório) e pode trocar a senha.
 * Usa o papel loja_admin (lê apps/admin/.env.local ou .env.vercel.production).
 */
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";

const [cmd, branch = "dev", ...args] = process.argv.slice(2);
const COMMANDS = ["listar", "criar", "trocar-email", "nova-senha", "resetar-2fa", "remover"];
if (!COMMANDS.includes(cmd) || !["dev", "production"].includes(branch)) {
  console.error(`Uso: pnpm admin:usuario <${COMMANDS.join("|")}> <dev|production> [args]`);
  process.exit(1);
}

const envFile = resolve(import.meta.dirname, "..", branch === "dev" ? ".env.local" : ".env.vercel.production");
if (!existsSync(envFile)) {
  console.error(`Arquivo ${envFile} não existe. Rode antes: pnpm neon:setup ${branch}`);
  process.exit(1);
}
config({ path: envFile, quiet: true });
const url = process.env.DATABASE_URL;
if (!url || new URL(url).username !== "loja_admin") {
  console.error("DATABASE_URL do painel ausente ou não usa o papel loja_admin.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const q = <T = Record<string, unknown>>(text: string, params: unknown[] = []) => pool.query(text, params).then((r) => r.rows as T[]);

/** Senha provisória: 4 blocos de 5 caracteres legíveis (≈ 100 bits). */
function tempPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(20);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return chars.match(/.{5}/g)!.join("-");
}

async function confirmProduction(action: string) {
  if (branch !== "production") return;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`⚠  ${action} no PAINEL NO AR. Digite SIM para confirmar: `);
  rl.close();
  if (answer.trim() !== "SIM") {
    console.log("Cancelado.");
    process.exit(0);
  }
}

async function findUser(email: string) {
  const [u] = await q<{ id: string; name: string; email: string }>("select id, name, email from admin_user where lower(email) = lower($1)", [email]);
  if (!u) {
    console.error(`Nenhum usuário com e-mail ${email}.`);
    process.exit(1);
  }
  return u;
}

async function audit(summary: string, entityId: string) {
  await q(
    "insert into audit_log (user_email, action, entity, entity_id, summary) values ($1, 'segurança', 'conta', $2, $3)",
    ["script admin:usuario", entityId, summary],
  );
}

function showPassword(email: string, password: string) {
  console.log(`\n  E-mail:            ${email}`);
  console.log(`  Senha provisória:  ${password}\n`);
  console.log("  Entregue por um canal seguro (pessoalmente ou mensagem que some).");
  console.log("  No primeiro acesso, o painel exige configurar o código no celular (2FA).\n");
}

async function main() {
  if (cmd === "listar") {
    const rows = await q<{ name: string; email: string; role: string; two_factor_enabled: boolean; created_at: Date }>(
      "select name, email, role, two_factor_enabled, created_at from admin_user order by created_at",
    );
    if (!rows.length) console.log("Nenhum usuário.");
    for (const r of rows) console.log(`• ${r.name} <${r.email}> — ${r.role} — 2FA ${r.two_factor_enabled ? "ativo" : "PENDENTE"} — desde ${r.created_at.toLocaleDateString("pt-BR")}`);
    return;
  }

  if (cmd === "criar") {
    const [name, email, role = "admin"] = args;
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["dona", "admin"].includes(role)) {
      console.error('Uso: pnpm admin:usuario criar <dev|production> "Nome" email@exemplo.com [dona|admin]');
      process.exit(1);
    }
    const [exists] = await q("select 1 from admin_user where lower(email) = lower($1)", [email]);
    if (exists) {
      console.error("Já existe usuário com esse e-mail.");
      process.exit(1);
    }
    await confirmProduction(`Criar acesso para ${email}`);
    const id = randomUUID();
    const password = tempPassword();
    const hash = await hashPassword(password);
    const now = new Date();
    await q("insert into admin_user (id, name, email, role, email_verified, two_factor_enabled, created_at, updated_at) values ($1,$2,lower($3),$5,true,false,$4,$4)", [id, name, email, now, role]);
    await q("insert into admin_account (id, account_id, provider_id, user_id, password, created_at, updated_at) values ($1,$2,'credential',$2,$3,$4,$4)", [randomUUID(), id, hash, now]);
    await audit(`Acesso criado para ${email} (${role})`, id);
    console.log(`\n✓ Acesso criado (${branch}).`);
    showPassword(email.toLowerCase(), password);
    return;
  }

  const email = args[0];
  if (!email) {
    console.error(`Uso: pnpm admin:usuario ${cmd} <dev|production> email@exemplo.com`);
    process.exit(1);
  }
  const u = await findUser(email);

  if (cmd === "trocar-email") {
    const next = args[1];
    if (!next || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      console.error("Uso: pnpm admin:usuario trocar-email <dev|production> atual@exemplo.com novo@exemplo.com");
      process.exit(1);
    }
    const [taken] = await q("select 1 from admin_user where lower(email) = lower($1)", [next]);
    if (taken) {
      console.error("Já existe usuário com o novo e-mail.");
      process.exit(1);
    }
    await confirmProduction(`Trocar o e-mail de login ${u.email} → ${next}`);
    await q("update admin_user set email = lower($1), updated_at = now() where id = $2", [next, u.id]);
    await q("delete from admin_session where user_id = $1", [u.id]);
    await audit(`E-mail de login trocado: ${u.email} → ${next.toLowerCase()}`, u.id);
    console.log(`\n✓ E-mail de login agora é ${next.toLowerCase()} (${branch}). Senha e 2FA continuam os mesmos.\n`);
  } else if (cmd === "nova-senha") {
    await confirmProduction(`Trocar a senha de ${u.email}`);
    const password = tempPassword();
    await q("update admin_account set password = $1, updated_at = now() where user_id = $2 and provider_id = 'credential'", [await hashPassword(password), u.id]);
    await q("delete from admin_session where user_id = $1", [u.id]);
    await audit(`Senha redefinida por script para ${u.email} (sessões encerradas)`, u.id);
    console.log(`\n✓ Senha redefinida e sessões encerradas (${branch}).`);
    showPassword(u.email, password);
  } else if (cmd === "resetar-2fa") {
    await confirmProduction(`Remover o 2FA de ${u.email} (para configurar num celular novo)`);
    await q("delete from admin_two_factor where user_id = $1", [u.id]);
    await q("update admin_user set two_factor_enabled = false, updated_at = now() where id = $1", [u.id]);
    await q("delete from admin_session where user_id = $1", [u.id]);
    await audit(`2FA redefinido por script para ${u.email}`, u.id);
    console.log(`\n✓ 2FA removido e sessões encerradas. No próximo login, ${u.name} configura o celular novo.\n`);
  } else if (cmd === "remover") {
    await confirmProduction(`REMOVER o acesso de ${u.email}`);
    await q("delete from admin_user where id = $1", [u.id]);
    await audit(`Acesso removido: ${u.email}`, u.id);
    console.log(`\n✓ Acesso de ${u.email} removido (${branch}). O histórico de alterações dessa pessoa é mantido.\n`);
  }
}

main()
  .catch((e) => {
    console.error(`Erro: ${(e as Error).message.replace(/postgres(ql)?:\/\/\S+/g, "<url oculta>")}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
