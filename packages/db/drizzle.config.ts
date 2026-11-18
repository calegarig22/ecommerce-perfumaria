import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// packages/db/.env.local é gerado por "pnpm neon:setup dev" (dono do schema, banco de testes).
config({ path: ".env.local", quiet: true });

// Migrações usam o papel dono do schema (DDL). Site e painel usam papéis restritos.
const url = process.env.DATABASE_URL_MIGRATIONS;

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: url ?? "" },
  strict: true,
  verbose: false,
});
