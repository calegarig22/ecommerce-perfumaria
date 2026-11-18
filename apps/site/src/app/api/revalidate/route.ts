import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

/**
 * Chamado pelo painel admin depois de salvar algo no catálogo, para o site
 * mostrar a mudança na hora. Protegido por segredo compartilhado (REVALIDATE_SECRET).
 * Só descarta cache — não recebe nem altera dados.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || secret.length < 32) return new Response(null, { status: 404 });

  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response(null, { status: 401 });

  revalidateTag("catalog", { expire: 0 });
  return Response.json({ ok: true });
}
