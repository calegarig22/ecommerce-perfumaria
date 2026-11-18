"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { ORDER_STATUS_LABEL, canTransition, type OrderStatus } from "@perfumaria/db/orders";
import { db, schema as s } from "../db";
import { requireUser } from "../session";
import { diff, recordAudit } from "../audit";
import type { ActionState } from "./catalog";

const input = z.object({
  status: z.enum(s.orderStatusEnum.enumValues),
  trackingCode: z
    .string()
    .trim()
    .max(60)
    .transform((v) => v || null),
  internalNotes: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => v || null),
});

export async function updateOrder(code: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const [order] = await db().select().from(s.orders).where(eq(s.orders.code, code));
  if (!order) return { ok: false, message: "Pedido não encontrado." };
  const parsed = input.safeParse({
    status: fd.get("status") ?? order.status,
    trackingCode: fd.get("trackingCode") ?? "",
    internalNotes: fd.get("internalNotes") ?? "",
  });
  if (!parsed.success) return { ok: false, message: "Dados inválidos." };
  const next = parsed.data.status as OrderStatus;
  if (next !== order.status && !canTransition(order.status, next)) {
    return { ok: false, message: `Não é possível mudar de "${ORDER_STATUS_LABEL[order.status]}" para "${ORDER_STATUS_LABEL[next]}".` };
  }
  const set: Partial<typeof s.orders.$inferInsert> = {
    status: next,
    trackingCode: parsed.data.trackingCode,
    internalNotes: parsed.data.internalNotes,
  };
  if (next !== order.status && next === "shipped") set.shippedAt = new Date();
  if (next !== order.status && next === "canceled") set.canceledAt = new Date();
  const changes = diff(order, { status: next, trackingCode: set.trackingCode, internalNotes: set.internalNotes }, {
    status: "status",
    trackingCode: "rastreio",
    internalNotes: "observação",
  });
  if (!Object.keys(changes).length) return { ok: true, message: "Nada mudou." };
  await db().update(s.orders).set(set).where(eq(s.orders.id, order.id));
  await recordAudit(user, { action: "atualizar", entity: "pedido", entityId: order.code, summary: `Pedido ${order.code}`, changes });
  refresh();
  return { ok: true, message: "Pedido atualizado." };
}
