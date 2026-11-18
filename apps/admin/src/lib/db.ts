import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "@perfumaria/db/schema";
import { env } from "./env";

// Pool (WebSocket) em vez de HTTP: o painel precisa de transações
// (ex.: criar fragrância + produtos + variações de uma vez).
let cached: ReturnType<typeof create> | null = null;

function create() {
  return drizzle({ client: new Pool({ connectionString: env().DATABASE_URL }), schema });
}

export function db() {
  cached ??= create();
  return cached;
}

export { schema };
