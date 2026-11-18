"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { db, schema as s } from "../db";
import { isFreshLogin, requireAdmin } from "../session";
import { recordAudit } from "../audit";
import { FRESH_LOGIN_MESSAGE } from "@/components/auth-errors";

/**
 * Gestão de acessos ao painel (só perfil Admin, com login recente).
 * Mesmas regras do script `pnpm admin:usuario`: senha provisória mostrada uma vez,
 * 2FA obrigatório no primeiro acesso, sessões derrubadas ao trocar senha/e-mail/2FA.
 */

export type UserActionState = null | { ok: boolean; message: string; password?: string; email?: string };

const fail = (message: string): UserActionState => ({ ok: false, message });

/** Senha provisória: 4 blocos de 5 caracteres legíveis (≈ 100 bits), sem viés de módulo. */
function tempPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
  const out: string[] = [];
  while (out.length < 20) {
    for (const b of randomBytes(32)) {
      if (b < 216 && out.length < 20) out.push(alphabet[b % alphabet.length]); // 216 = 4 × 54
    }
  }
  return out.join("").match(/.{5}/g)!.join("-");
}

async function guard() {
  const user = await requireAdmin();
  if (!isFreshLogin(user.session)) return { user, error: FRESH_LOGIN_MESSAGE };
  return { user, error: null };
}

const newUserSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(120),
  role: z.enum(["dona", "admin"]),
});

export async function createUser(_prev: UserActionState, fd: FormData): Promise<UserActionState> {
  const { user, error } = await guard();
  if (error) return fail(error);
  const parsed = newUserSchema.safeParse({ name: fd.get("name") ?? "", email: fd.get("email") ?? "", role: fd.get("role") ?? "" });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { name, email, role } = parsed.data;
  const requireTwoFactor = fd.get("requireTwoFactor") === "on";
  const [exists] = await db().select({ id: s.adminUsers.id }).from(s.adminUsers).where(eq(s.adminUsers.email, email));
  if (exists) return fail("Já existe um acesso com esse e-mail.");

  const password = tempPassword();
  const id = randomUUID();
  const hash = await hashPassword(password);
  const now = new Date();
  await db().transaction(async (tx) => {
    await tx.insert(s.adminUsers).values({ id, name, email, role, requireTwoFactor, emailVerified: true, twoFactorEnabled: false, createdAt: now, updatedAt: now });
    await tx.insert(s.adminAccounts).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: hash, createdAt: now, updatedAt: now });
  });
  await recordAudit(user, { action: "segurança", entity: "conta", entityId: id, summary: `Acesso criado para ${email} (${role}${requireTwoFactor ? "" : ", 2FA opcional"})` });
  refresh();
  return { ok: true, message: `Acesso criado para ${email}.`, password, email };
}

async function target(userId: string) {
  const [u] = await db().select().from(s.adminUsers).where(eq(s.adminUsers.id, userId));
  return u ?? null;
}

/** Gera senha provisória nova e derruba as sessões da pessoa. */
export async function resetPassword(userId: string, _prev: UserActionState): Promise<UserActionState> {
  void _prev; // assinatura exigida por useActionState
  const { user, error } = await guard();
  if (error) return fail(error);
  const u = await target(userId);
  if (!u) return fail("Acesso não encontrado.");
  if (u.id === user.id) return fail("Para a sua própria senha, use Minha conta.");
  const password = tempPassword();
  await db()
    .update(s.adminAccounts)
    .set({ password: await hashPassword(password), updatedAt: new Date() })
    .where(and(eq(s.adminAccounts.userId, u.id), eq(s.adminAccounts.providerId, "credential")));
  await db().delete(s.adminSessions).where(eq(s.adminSessions.userId, u.id));
  await recordAudit(user, { action: "segurança", entity: "conta", entityId: u.id, summary: `Senha provisória nova para ${u.email}` });
  refresh();
  return { ok: true, message: `Senha nova para ${u.email}. As sessões abertas dela foram encerradas.`, password, email: u.email };
}

/** Celular perdido: apaga o 2FA; no próximo login a pessoa configura de novo. */
export async function resetTwoFactor(userId: string, _prev: UserActionState): Promise<UserActionState> {
  void _prev; // assinatura exigida por useActionState
  const { user, error } = await guard();
  if (error) return fail(error);
  const u = await target(userId);
  if (!u) return fail("Acesso não encontrado.");
  if (u.id === user.id) return fail("Não dá para zerar o próprio 2FA aqui (use o script em caso de emergência).");
  await db().transaction(async (tx) => {
    await tx.delete(s.adminTwoFactors).where(eq(s.adminTwoFactors.userId, u.id));
    await tx.update(s.adminUsers).set({ twoFactorEnabled: false, updatedAt: new Date() }).where(eq(s.adminUsers.id, u.id));
    await tx.delete(s.adminSessions).where(eq(s.adminSessions.userId, u.id));
  });
  await recordAudit(user, { action: "segurança", entity: "conta", entityId: u.id, summary: `2FA zerado para ${u.email}` });
  refresh();
  return { ok: true, message: `2FA zerado para ${u.email}. No próximo login ela configura o app autenticador de novo.` };
}

const editSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(120),
  role: z.enum(["dona", "admin"]),
});

export async function updateUser(userId: string, _prev: UserActionState, fd: FormData): Promise<UserActionState> {
  const { user, error } = await guard();
  if (error) return fail(error);
  const u = await target(userId);
  if (!u) return fail("Acesso não encontrado.");
  const parsed = editSchema.safeParse({ name: fd.get("name") ?? "", email: fd.get("email") ?? "", role: fd.get("role") ?? "" });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const next = { ...parsed.data, requireTwoFactor: fd.get("requireTwoFactor") === "on" };
  if (u.id === user.id && next.role !== "admin") return fail("Você não pode tirar o seu próprio perfil de Admin.");
  if (next.email !== u.email) {
    const [taken] = await db().select({ id: s.adminUsers.id }).from(s.adminUsers).where(and(eq(s.adminUsers.email, next.email), ne(s.adminUsers.id, u.id)));
    if (taken) return fail("Esse e-mail já é usado por outro acesso.");
  }
  if (u.name === next.name && u.email === next.email && u.role === next.role && u.requireTwoFactor === next.requireTwoFactor)
    return { ok: true, message: "Nada mudou." };
  await db().update(s.adminUsers).set({ ...next, updatedAt: new Date() }).where(eq(s.adminUsers.id, u.id));
  // E-mail ou perfil novo: derruba as sessões dela para valer na hora (exceto as suas).
  if ((next.email !== u.email || next.role !== u.role) && u.id !== user.id) await db().delete(s.adminSessions).where(eq(s.adminSessions.userId, u.id));
  const changes: Record<string, { de: unknown; para: unknown }> = {};
  const labels = { name: "nome", email: "e-mail", role: "perfil", requireTwoFactor: "2FA obrigatório" } as const;
  for (const k of ["name", "email", "role", "requireTwoFactor"] as const) if (u[k] !== next[k]) changes[labels[k]] = { de: u[k], para: next[k] };
  await recordAudit(user, { action: "segurança", entity: "conta", entityId: u.id, summary: `Acesso de ${u.email} alterado`, changes });
  refresh();
  return { ok: true, message: "Acesso atualizado." };
}

export async function removeUser(userId: string, _prev: UserActionState, fd: FormData): Promise<UserActionState> {
  const { user, error } = await guard();
  if (error) return fail(error);
  const u = await target(userId);
  if (!u) return fail("Acesso não encontrado.");
  if (u.id === user.id) return fail("Você não pode remover o seu próprio acesso.");
  if (String(fd.get("confirm") ?? "").trim().toLowerCase() !== u.email) return fail("Digite o e-mail para confirmar.");
  if (u.role === "admin") {
    const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(s.adminUsers).where(eq(s.adminUsers.role, "admin"));
    if (n <= 1) return fail("Precisa sobrar pelo menos um Admin.");
  }
  await db().delete(s.adminUsers).where(eq(s.adminUsers.id, u.id)); // sessões, conta e 2FA saem em cascata
  await recordAudit(user, { action: "segurança", entity: "conta", entityId: u.id, summary: `Acesso removido: ${u.email}` });
  refresh();
  return { ok: true, message: `Acesso de ${u.email} removido. O histórico de alterações dela é mantido.` };
}
