/** Trocar senha, gerar códigos e encerrar sessões exigem login recente (freshAge em lib/auth.ts). */
export const FRESH_LOGIN_MESSAGE = "Por segurança, isso exige um login recente: clique em Sair, entre de novo e repita (vale por 10 minutos).";

/** Mensagens neutras: nunca dizer se o e-mail existe. */
export function authErrorMessage(err: { status?: number; code?: string; message?: string } | null | undefined) {
  if (!err) return "Não foi possível concluir. Tente novamente.";
  if (err.status === 429) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (err.code === "SESSION_NOT_FRESH") return FRESH_LOGIN_MESSAGE;
  if (err.code === "PASSWORD_COMPROMISED" || /vazamentos/.test(err.message ?? "")) return err.message!;
  if (err.code === "INVALID_CODE" || err.code === "INVALID_TWO_FACTOR_CODE" || /code/i.test(err.code ?? ""))
    return "Código inválido ou expirado.";
  if (err.status === 401 || err.status === 400 || err.status === 403) return "E-mail ou senha incorretos.";
  return "Não foi possível concluir. Tente novamente.";
}
