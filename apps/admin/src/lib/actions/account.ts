"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { auth } from "../auth";
import { requireUser } from "../session";
import { recordAudit } from "../audit";

export async function revokeOtherSessions(): Promise<void> {
  const user = await requireUser();
  try {
    await auth().api.revokeOtherSessions({ headers: await headers() });
  } catch (e) {
    // Exige login recente: em vez de quebrar a página, explica o que fazer.
    if (e instanceof APIError && e.body?.code === "SESSION_NOT_FRESH") redirect("/conta?erro=login-recente");
    throw e;
  }
  await recordAudit(user, { action: "segurança", entity: "conta", entityId: user.id, summary: "Encerrou as outras sessões" });
  refresh();
}

export async function logPasswordChanged(): Promise<void> {
  const user = await requireUser();
  await recordAudit(user, { action: "segurança", entity: "conta", entityId: user.id, summary: "Trocou a senha" });
}

export async function logBackupCodesRegenerated(): Promise<void> {
  const user = await requireUser();
  await recordAudit(user, { action: "segurança", entity: "conta", entityId: user.id, summary: "Gerou novos códigos de recuperação" });
}

export async function logTwoFactorDisabled(): Promise<void> {
  const user = await requireUser();
  await recordAudit(user, { action: "segurança", entity: "conta", entityId: user.id, summary: "Desligou a verificação em duas etapas (2FA opcional)" });
}
