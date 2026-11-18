import "server-only";
import { env } from "./env";

/**
 * E-mail de aviso a cada login no painel (via Resend, API HTTP — sem SDK).
 * Opcional: sem RESEND_API_KEY/LOGIN_ALERT_FROM, só registra no histórico.
 */
export async function sendLoginAlert(p: { email: string; name: string; ip: string | null; userAgent: string | null }) {
  const { RESEND_API_KEY, LOGIN_ALERT_FROM } = env();
  if (!RESEND_API_KEY || !LOGIN_ALERT_FROM) return;
  const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date());
  const text = [
    `Olá, ${p.name}.`,
    "",
    `Houve um novo acesso ao painel da loja com a sua conta em ${when}.`,
    `IP: ${p.ip ?? "desconhecido"}`,
    `Navegador: ${p.userAgent ?? "desconhecido"}`,
    "",
    "Se foi você, pode ignorar este e-mail.",
    "Se NÃO foi você: troque a senha imediatamente em Minha conta e encerre as outras sessões.",
  ].join("\n");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: LOGIN_ALERT_FROM, to: [p.email], subject: "Novo acesso ao painel da loja", text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("login-alert: Resend respondeu", res.status);
  } catch (err) {
    console.error("login-alert: falha no envio", (err as Error).message);
  }
}
