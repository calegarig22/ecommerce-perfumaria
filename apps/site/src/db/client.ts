import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { serverEnv } from "@/lib/env";
import * as schema from "@perfumaria/db/schema";

let cached: ReturnType<typeof create> | null = null;

function create(url: string) {
  return drizzle({ client: neon(url), schema });
}

/** Retorna o client do banco, ou null se DATABASE_URL não estiver configurada. */
export function getDb() {
  const url = serverEnv().DATABASE_URL;
  if (!url) return null;
  cached ??= create(url);
  return cached;
}
