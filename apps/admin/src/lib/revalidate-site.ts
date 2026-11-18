import "server-only";
import { env } from "./env";

/**
 * Pede ao site público para descartar o cache do catálogo, para a mudança
 * aparecer na hora (sem isso, o site atualiza sozinho em até 1 hora).
 * Retorna false se o site não respondeu — a alteração já está salva no banco.
 */
export async function revalidateSite(): Promise<boolean> {
  const { SITE_URL, REVALIDATE_SECRET } = env();
  try {
    const res = await fetch(new URL("/api/revalidate", SITE_URL), {
      method: "POST",
      headers: { Authorization: `Bearer ${REVALIDATE_SECRET}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
