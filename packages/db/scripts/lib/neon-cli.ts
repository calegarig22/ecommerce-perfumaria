/**
 * Ajudantes para falar com o Neon pela CLI oficial (`neon`), já logada na conta.
 * Nenhuma função aqui imprime connection strings ou senhas.
 */
import { execFileSync } from "node:child_process";

/** ID do projeto Neon (defina NEON_PROJECT_ID no ambiente). */
export const NEON_PROJECT_ID = process.env.NEON_PROJECT_ID ?? "";
export const DATABASE = "neondb";
export const SITE_ROLE = "loja_site";
export const ADMIN_ROLE = "loja_admin";
export const BRANCHES = ["dev", "production"] as const;
export type Branch = (typeof BRANCHES)[number];

export function parseBranch(value: string | undefined): Branch {
  if (!NEON_PROJECT_ID) {
    console.error("Defina NEON_PROJECT_ID no ambiente (ID do seu projeto Neon).");
    process.exit(1);
  }
  if (value && (BRANCHES as readonly string[]).includes(value)) return value as Branch;
  console.error(`Branch inválida. Use: ${BRANCHES.join(" | ")}`);
  process.exit(1);
}

function neon(args: string[]) {
  try {
    return execFileSync("neon", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) {
    const err = e as { stderr?: string; code?: string };
    if (err.code === "ENOENT") throw new Error("CLI do Neon não encontrada. Instale com: npm i -g neonctl && neon auth");
    const msg = String(err.stderr ?? "").replace(/postgres(ql)?:\/\/\S+/g, "<url oculta>");
    throw new Error(`neon ${args[0]} falhou: ${msg.split("\n").find(Boolean) ?? "erro desconhecido"}`);
  }
}

export function ownerUrl(branch: Branch, pooled = false) {
  return neon([
    "connection-string", branch,
    "--project-id", NEON_PROJECT_ID,
    "--database-name", DATABASE,
    "--role-name", "neondb_owner",
    ...(pooled ? ["--pooled"] : []),
  ]);
}

export function deleteApiRole(branch: Branch, role: string) {
  try {
    neon(["roles", "delete", role, "--project-id", NEON_PROJECT_ID, "--branch", branch]);
    return true;
  } catch {
    return false;
  }
}

/** Reinicia o compute da branch (limpa sessões guardadas pelo pooler). */
export function restartCompute(branch: Branch) {
  const b = JSON.parse(neon(["branches", "get", branch, "--project-id", NEON_PROJECT_ID, "-o", "json"]));
  const branchId = b.branch?.id ?? b.id;
  const { endpoints } = JSON.parse(neon(["api", `/projects/${NEON_PROJECT_ID}/endpoints`]));
  for (const ep of endpoints.filter((e: { branch_id: string }) => e.branch_id === branchId)) {
    neon(["api", `/projects/${NEON_PROJECT_ID}/endpoints/${ep.id}/restart`, "-X", "POST"]);
  }
}
