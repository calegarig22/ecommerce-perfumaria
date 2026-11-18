import "server-only";
import { headers } from "next/headers";
import { db, schema } from "./db";

export type Actor = { id: string; email: string };

type Entry = {
  action: string;
  entity: string;
  entityId?: string | number | null;
  summary: string;
  changes?: Record<string, { de: unknown; para: unknown }> | null;
  ip?: string | null;
};

async function requestIp() {
  try {
    return (await headers()).get("x-real-ip");
  } catch {
    return null;
  }
}

/** Grava no histórico. Falha aqui não pode esconder a alteração: registra no log do servidor. */
export async function recordAudit(actor: Actor, e: Entry) {
  try {
    await db()
      .insert(schema.auditLog)
      .values({
        userId: actor.id,
        userEmail: actor.email,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId == null ? null : String(e.entityId),
        summary: e.summary,
        changes: e.changes ?? null,
        ip: e.ip !== undefined ? e.ip : await requestIp(),
      });
  } catch (err) {
    console.error("audit_log: falha ao registrar", e.action, e.entity, (err as Error).message);
  }
}

/** Diferença campo a campo entre antes/depois (só o que mudou). */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>, labels: Partial<Record<keyof T, string>> = {}) {
  const out: Record<string, { de: unknown; para: unknown }> = {};
  for (const k of Object.keys(after) as (keyof T)[]) {
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[(labels[k] as string) ?? String(k)] = { de: a ?? null, para: b ?? null };
  }
  return out;
}
