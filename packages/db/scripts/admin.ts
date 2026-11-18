/**
 * Abre o Drizzle Studio (edição crua do banco) — uso TÉCNICO, emergências.
 * Para o dia a dia da loja, use o painel (apps/admin).
 *
 *   pnpm db:studio               → banco de testes (dev)
 *   pnpm db:studio production    → banco do site no ar
 *
 * Roda só no seu computador. A senha de dono é buscada na hora pela CLI do Neon.
 */
import { spawn } from "node:child_process";
import { ownerUrl, parseBranch } from "./lib/neon-cli";

const branch = parseBranch(process.argv[2] ?? "dev");

if (branch === "production") {
  console.log("\n⚠  Você está editando o banco do SITE NO AR.\n");
}

const url = ownerUrl(branch);
const child = spawn("pnpm", ["exec", "drizzle-kit", "studio"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL_MIGRATIONS: url },
});
child.on("exit", (code) => process.exit(code ?? 0));
