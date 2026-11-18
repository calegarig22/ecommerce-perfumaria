import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LOW_STOCK, listLines, listProducts } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { centsToInput, formatSize } from "@/lib/format";
import { quickPrices } from "@/lib/actions/catalog";
import { PageHeader } from "@/components/page-header";
import { ActionForm } from "@/components/action-form";
import { BulkBar } from "@/components/bulk-bar";
import { StockStepper } from "@/components/stock-stepper";

export const metadata: Metadata = { title: "Produtos" };

const STATUS = [
  { v: "", label: "Todos" },
  { v: "ativos", label: "À venda" },
  { v: "inativos", label: "Escondidos" },
  { v: "sem-foto", label: "Sem foto" },
  { v: "sem-preco", label: "Sem preço" },
  { v: "estoque-baixo", label: "Acabando" },
  { v: "destaque", label: "Em destaque" },
];

export default async function ProductsPage({ searchParams }: PageProps<"/produtos">) {
  await requireUser();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 60) || undefined;
  const filter = { q: one(sp.q), linha: one(sp.linha), status: one(sp.status) };
  const [lines, products] = await Promise.all([listLines(), listProducts(filter)]);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filter, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/produtos?${s}` : "/produtos";
  };

  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle={`${products.length} produto(s). Mude preço e estoque aqui mesmo; toque no nome para fotos e detalhes.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={filter.linha ? `/produtos/novo?categoria=${encodeURIComponent(filter.linha)}` : "/produtos/novo"} className="btn-primary">
              + Novo produto
            </Link>
          </div>
        }
      />

      {one(sp.excluido) === "1" && <p role="status" className="mb-4 rounded-md bg-ok/10 p-3 text-sm text-ok">Produto excluído.</p>}

      {/* Filtros rápidos (um toque) */}
      <nav aria-label="Mostrar" className="-mx-4 mb-3 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex min-w-max gap-2">
          {STATUS.map((s) => {
            const active = (filter.status ?? "") === s.v;
            return (
              <li key={s.v}>
                <Link
                  href={qs({ status: s.v || undefined })}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm ${
                    active ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink"
                  }`}
                >
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        {filter.status && <input type="hidden" name="status" value={filter.status} />}
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="label">Buscar</label>
          <input id="q" name="q" type="search" defaultValue={filter.q} placeholder="Nome ou família olfativa" className="field" />
        </div>
        <div>
          <label htmlFor="linha" className="label">Categoria</label>
          <select id="linha" name="linha" defaultValue={filter.linha ?? ""} className="field">
            <option value="">Todas</option>
            {lines.map((l) => (
              <option key={l.id} value={l.slug}>{l.name}</option>
            ))}
          </select>
        </div>
        <button className="btn-secondary">Filtrar</button>
      </form>

      <BulkBar />

      <ActionForm action={quickPrices} submitLabel="Salvar preços" sticky>
        <ul className="space-y-2">
          {products.map((p) => (
            <li key={p.id} className={`card flex flex-wrap items-center gap-x-4 gap-y-3 p-3 ${p.active ? "" : "bg-nude/40"}`}>
              <input type="checkbox" form="lote" name="ids" value={p.id} className="size-5 shrink-0" aria-label={`Marcar ${p.name} ${p.lineName}`} />
              <Link href={`/produtos/${p.id}`} className="group flex min-w-0 flex-1 basis-56 items-center gap-3">
                <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-md bg-nude text-[0.625rem] text-muted">
                  {p.cover ? (
                    <Image src={p.cover} alt="" fill sizes="56px" className={p.defaultPhoto ? "object-contain p-1" : "object-cover"} />
                  ) : (
                    "sem foto"
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink group-hover:text-accent group-hover:underline">{p.name}</span>
                  <span className="block truncate text-xs text-muted">{[p.lineName, p.family].filter(Boolean).join(" · ")}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {p.active ? <span className="badge bg-ok/10 text-ok">À venda</span> : <span className="badge bg-nude text-muted">Escondido</span>}
                    {p.featured && <span className="badge bg-caramel/20 text-accent-deep">Destaque</span>}
                    {p.defaultPhoto && <span className="badge bg-nude text-muted">Foto padrão</span>}
                  </span>
                </span>
              </Link>
              <div className="flex w-full flex-col gap-2 sm:w-auto">
                {p.variants.map((v) => {
                  const size = formatSize(v.size, v.unit, v.label);
                  return (
                    <div key={v.id} className="flex flex-wrap items-center gap-2">
                      <span className="w-20 text-xs text-muted">{size || "—"}</span>
                      <label className="sr-only" htmlFor={`p${v.id}`}>Preço {p.name} {p.lineName} {size}</label>
                      <span className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted">R$</span>
                        <input
                          id={`p${v.id}`}
                          name={`p${v.id}`}
                          defaultValue={centsToInput(v.priceCents)}
                          placeholder="consulta"
                          inputMode="decimal"
                          className="field w-28 py-1.5 pl-8"
                        />
                      </span>
                      {v.stock == null ? (
                        <span className="w-32 text-xs text-muted">sob encomenda</span>
                      ) : (
                        <StockStepper variantId={v.id} stock={v.stock} low={LOW_STOCK} label={`${p.name} ${p.lineName} ${size}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
          {!products.length && <li className="card p-8 text-center text-muted">Nenhum produto encontrado.</li>}
        </ul>
        <p className="mt-2 text-xs text-muted">Preço vazio aparece como “sob consulta” no site. Formato: 89,90. O estoque (− / +) salva na hora.</p>
      </ActionForm>
    </>
  );
}
