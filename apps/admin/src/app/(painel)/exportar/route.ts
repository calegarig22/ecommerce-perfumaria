import { requireUser } from "@/lib/session";
import { exportRows } from "@/lib/import/plan";
import { toCsv } from "@/lib/import/rows";
import { recordAudit } from "@/lib/audit";

/** Baixa o catálogo em planilha (CSV para Excel/Google Planilhas). ?modelo=1 baixa só o modelo com exemplos. */
export async function GET(req: Request) {
  const user = await requireUser();
  const modelo = new URL(req.url).searchParams.get("modelo") === "1";
  const rows = modelo
    ? [
        ["", "Aurora", "Perfume", 100, "ml", "", "129,90", 5, "sim", "Oriental Floral", "feminino", "Café, Pera", "Flor de Laranjeira", "Baunilha", ""],
        ["", "Lavanda Francesa", "Velas aromáticas", 180, "g", "", "59,90", 10, "sim", "Aromático", "", "", "", "", "Vela de cera vegetal, 40 h de queima."],
        ["", "Brisa", "Aromatizadores", 250, "ml", "Refil", "69,90", "encomenda", "não", "", "", "", "", "", ""],
      ]
    : await exportRows();
  if (!modelo) await recordAudit(user, { action: "exportar", entity: "catálogo", summary: `Planilha do catálogo baixada (${rows.length} linhas)` });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${modelo ? "modelo-produtos" : `catalogo-${date}`}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
