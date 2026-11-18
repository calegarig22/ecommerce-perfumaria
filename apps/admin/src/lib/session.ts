import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/** Sessão da requisição atual (deduplicada por render). Sempre consulta o banco: revogar é imediato. */
export const getSession = cache(async () => {
  // headers() primeiro: marca a página como dinâmica antes de tocar no banco/variáveis.
  const h = await headers();
  return auth().api.getSession({ headers: h });
});

/**
 * Camada de acesso: TODA página e Server Action do painel chama isto primeiro.
 * O proxy só faz um redirecionamento otimista; a checagem real é aqui.
 */
export async function requireUser(opts: { allowWithout2fa?: boolean } = {}) {
  const s = await getSession();
  if (!s) redirect("/entrar");
  // 2FA obrigatório por padrão; o Admin pode deixar opcional para uma pessoa (Usuários).
  const requireTwoFactor = (s.user as { requireTwoFactor?: boolean }).requireTwoFactor !== false;
  if (requireTwoFactor && !s.user.twoFactorEnabled && !opts.allowWithout2fa) redirect("/configurar-2fa");
  const role: "dona" | "admin" = (s.user as { role?: string }).role === "dona" ? "dona" : "admin";
  return {
    id: s.user.id,
    email: s.user.email,
    name: s.user.name,
    role,
    twoFactorEnabled: !!s.user.twoFactorEnabled,
    requireTwoFactor,
    session: s.session,
  };
}

/** Só o perfil Admin (suporte técnico) gerencia acessos ao painel. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** Login feito há até 10 minutos (mesmo critério do freshAge em lib/auth.ts). */
export function isFreshLogin(session: { createdAt: Date | string }) {
  return Date.now() - new Date(session.createdAt).getTime() < 10 * 60 * 1000;
}
