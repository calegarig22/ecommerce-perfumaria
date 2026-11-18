"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { Line, LineSlug, Product } from "@/lib/types";
import { familyTint } from "@/lib/format";
import { whatsappLink } from "@/lib/site";
import { ProductCard } from "./product-card";

const FAMILIES = ["Floral", "Frutado", "Oriental", "Amadeirado", "Aromático", "Chipre"] as const;
const GENDERS = [
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
] as const;
const SORTS = [
  { value: "destaques", label: "Destaques" },
  { value: "az", label: "Nome: A a Z" },
  { value: "za", label: "Nome: Z a A" },
] as const;

type Gender = (typeof GENDERS)[number]["value"];
type Family = (typeof FAMILIES)[number];
type Sort = (typeof SORTS)[number]["value"];

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Aceita só valores conhecidos vindos da URL. */
function pick<T extends string>(value: string | null, allowed: readonly T[]) {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

type Filters = { linha: LineSlug | null; para: Gender | null; familia: Family | null; q: string };

function matches(p: Product, f: Filters, skip?: keyof Filters) {
  if (skip !== "linha" && f.linha && p.line.slug !== f.linha) return false;
  if (skip !== "para" && f.para && p.gender !== f.para) return false;
  if (skip !== "familia" && f.familia && !p.family.split(" ").includes(f.familia)) return false;
  if (skip !== "q" && f.q) {
    const hay = norm([p.name, p.family, p.line.name, ...p.notes.top, ...p.notes.heart, ...p.notes.base].join(" "));
    if (!f.q.split(/\s+/).every((t) => hay.includes(t))) return false;
  }
  return true;
}

export function ShopBrowser({ products, lines }: { products: Product[]; lines: Line[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const sheetRef = useRef<HTMLDialogElement>(null);

  const linha = pick(params.get("linha"), lines.map((l) => l.slug));
  const para = pick(params.get("para"), GENDERS.map((g) => g.value));
  const familia = pick(params.get("familia"), FAMILIES);
  const ordem: Sort = pick(params.get("ordem"), SORTS.map((s) => s.value)) ?? "destaques";

  const [query, setQuery] = useState(() => (params.get("q") ?? "").slice(0, 60));
  const q = useDeferredValue(norm(query.trim()));

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Mantém a busca na URL (link compartilhável), com atraso para não pesar.
  useEffect(() => {
    const t = setTimeout(() => {
      const value = query.trim();
      if (value !== (params.get("q") ?? "")) update({ q: value || null });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara só quando o texto muda
  }, [query]);

  const filters: Filters = { linha, para, familia, q };

  // Catálogo pequeno (dezenas de itens): filtrar a cada render é instantâneo.
  const results = products
    .filter((p) => matches(p, filters))
    .toSorted((a, b) =>
      ordem === "az"
        ? a.name.localeCompare(b.name, "pt-BR")
        : ordem === "za"
          ? b.name.localeCompare(a.name, "pt-BR")
          : Number(b.featured) - Number(a.featured),
    );

  // Paginação "Mostrar mais": volta a 24 sempre que os filtros mudam.
  const PAGE = 24;
  const signature = `${linha}|${para}|${familia}|${q}|${ordem}`;
  const [page, setPage] = useState({ signature, shown: PAGE });
  const shown = page.signature === signature ? page.shown : PAGE;
  const visible = results.slice(0, shown);

  /** Contagem por opção, considerando os outros filtros já escolhidos. */
  const countBy = (key: keyof Filters, test: (p: Product) => boolean) =>
    products.filter((p) => matches(p, filters, key) && test(p)).length;

  const activeChips = [
    para && { label: GENDERS.find((g) => g.value === para)!.label, clear: () => update({ para: null }) },
    familia && { label: familia, clear: () => update({ familia: null }) },
    q && {
      label: `“${query.trim()}”`,
      clear: () => {
        setQuery("");
        update({ q: null });
      },
    },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const clearAll = () => {
    setQuery("");
    router.replace(linha ? `${pathname}?linha=${linha}` : pathname, { scroll: false });
  };

  const filterControls = (
    <>
      <FilterBlock title="Para">
        <Segmented
          options={[{ value: null, label: "Todos" }, ...GENDERS].map((o) => ({
            value: o.value as Gender | null,
            label: o.label,
            count: countBy("para", (p) => !o.value || p.gender === o.value),
          }))}
          value={para}
          onChange={(v) => update({ para: v })}
        />
      </FilterBlock>
      <FilterBlock title="Família olfativa">
        <div className="flex flex-wrap gap-2">
          {FAMILIES.map((f) => {
            const n = countBy("familia", (p) => p.family.split(" ").includes(f));
            const active = familia === f;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={active}
                disabled={!n && !active}
                onClick={() => update({ familia: active ? null : f })}
                className="flex min-h-11 items-center gap-2 rounded-pill border border-line-strong px-4 text-sm transition-colors hover:border-ink disabled:opacity-35 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper"
              >
                <span aria-hidden className="size-2.5 rounded-pill" style={{ background: familyTint(f) }} />
                {f}
                <span className="text-xs opacity-60 tabular-nums">{n}</span>
              </button>
            );
          })}
        </div>
      </FilterBlock>
    </>
  );

  const sortSelect = (id: string, showLabel = true) => (
    <div className="flex items-center gap-3 text-sm">
      <label htmlFor={id} className={showLabel ? "shrink-0 text-muted" : "sr-only"}>
        Ordenar
      </label>
      <select
        id={id}
        value={ordem}
        onChange={(e) => update({ ordem: e.target.value === "destaques" ? null : e.target.value })}
        className="h-12 rounded-sm border border-line-strong bg-paper px-3 pr-8 text-sm focus:border-ink"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );

  const activeCount = (para ? 1 : 0) + (familia ? 1 : 0);

  return (
    <div>
      {/* Linhas: navegação principal da loja */}
      <div className="relative">
      <span aria-hidden className="pointer-events-none absolute -right-4 top-0 z-10 h-full w-12 bg-gradient-to-l from-paper to-transparent sm:hidden" />
      <nav aria-label="Linhas" className="-mx-4 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <ul className="flex min-w-max gap-7 sm:gap-10">
          {[{ slug: null as LineSlug | null, name: "Todos" }, ...lines.map((l) => ({ slug: l.slug as LineSlug | null, name: l.name }))].map(
            (l) => {
              const active = linha === l.slug;
              const n = countBy("linha", (p) => !l.slug || p.line.slug === l.slug);
              return (
                <li key={l.slug ?? "todos"}>
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => update({ linha: l.slug })}
                    className={`relative flex min-h-14 items-baseline gap-2 pb-1 font-display text-[1.35rem] transition-colors sm:text-[1.6rem] ${
                      active ? "text-ink" : "text-ink/45 hover:text-ink"
                    }`}
                  >
                    {l.name}
                    <span className="font-sans text-xs text-muted tabular-nums">{n}</span>
                    {active && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-ink" />}
                  </button>
                </li>
              );
            },
          )}
        </ul>
      </nav>
      </div>

      {/* Busca + botão de filtros (mobile) + ordenação (desktop) */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <label htmlFor="busca" className="sr-only">
            Buscar por nome ou nota
          </label>
          <input
            id="busca"
            type="search"
            value={query}
            maxLength={60}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou nota (ex.: baunilha)"
            className="h-12 w-full rounded-sm border border-line-strong bg-paper pl-12 pr-4 text-base placeholder:text-muted/80 focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
          />
        </div>
        <button
          type="button"
          onClick={() => sheetRef.current?.showModal()}
          className="label-caps flex h-12 items-center justify-center gap-2 rounded-sm border border-line-strong px-5 text-[0.7rem] lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="10" cy="17" r="2" />
          </svg>
          Filtrar e ordenar{activeCount ? ` (${activeCount})` : ""}
        </button>
        <div className="hidden lg:block">{sortSelect("ordem-desktop")}</div>
      </div>

      {/* Filtros sempre visíveis no desktop */}
      <div className="mt-6 hidden gap-12 lg:flex lg:items-start">{filterControls}</div>

      {/* Contagem + filtros ativos */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
        <p className="mr-2 text-sm text-muted" aria-live="polite">
          {results.length} {results.length === 1 ? "produto" : "produtos"}
        </p>
        {activeChips.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={c.clear}
            className="flex min-h-9 items-center gap-2 rounded-pill bg-nude px-3.5 text-sm hover:bg-nude-deep"
            aria-label={`Remover filtro ${c.label}`}
          >
            {c.label}
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ))}
        {activeChips.length > 0 && (
          <button type="button" onClick={clearAll} className="link-quiet ml-1 py-2 text-sm">
            Limpar tudo
          </button>
        )}
      </div>

      {results.length ? (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <li key={p.slug}>
              <ProductCard product={p} showLine={!linha} />
            </li>
          ))}
        </ul>
      ) : null}

      {results.length > shown && (
        <div className="mt-14 flex flex-col items-center gap-3">
          <p className="text-sm text-muted">
            Mostrando {shown} de {results.length}
          </p>
          <div aria-hidden className="h-px w-40 bg-line">
            <div className="h-px bg-ink" style={{ width: `${(shown / results.length) * 100}%` }} />
          </div>
          <button type="button" onClick={() => setPage({ signature, shown: shown + PAGE })} className="btn-secondary mt-2 w-full sm:w-auto">
            Mostrar mais
          </button>
        </div>
      )}

      {results.length ? null : (
        <div className="mx-auto mt-16 max-w-md text-center">
          <p className="font-display text-3xl">Nenhum produto encontrado</p>
          <p className="mt-3 text-ink/75">Tente outra nota ou família, ou limpe os filtros. Também podemos indicar uma pelo WhatsApp.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={clearAll} className="btn-secondary">
              Limpar filtros
            </button>
            <a
              href={whatsappLink(`Olá! Procuro uma fragrância${q ? ` com ${query.trim()}` : ""}. Podem me indicar?`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              Pedir indicação
            </a>
          </div>
        </div>
      )}

      {/* Painel de filtros no celular */}
      <dialog
        ref={sheetRef}
        aria-labelledby="filtros-titulo"
        className="sheet m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-md bg-paper p-0 text-ink backdrop:bg-ink/40"
        onClick={(e) => {
          if (e.target === e.currentTarget) sheetRef.current?.close();
        }}
      >
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 id="filtros-titulo" className="font-display text-2xl">
              Filtrar e ordenar
            </h2>
            <button type="button" onClick={() => sheetRef.current?.close()} className="grid size-11 place-items-center" aria-label="Fechar filtros">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6">
            {filterControls}
            <FilterBlock title="Ordenar">{sortSelect("ordem-mobile", false)}</FilterBlock>
          </div>
          <div className="flex gap-3 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {activeCount > 0 && (
              <button type="button" onClick={clearAll} className="btn-secondary flex-1">
                Limpar
              </button>
            )}
            <button type="button" onClick={() => sheetRef.current?.close()} className="btn-primary flex-[2]">
              Ver {results.length} {results.length === 1 ? "produto" : "produtos"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function FilterBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="label-caps mb-3 text-[0.68rem] text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T | null; label: string; count: number }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex w-full rounded-sm border border-line-strong p-1 sm:inline-flex sm:w-auto">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-sm px-3 text-sm text-ink/75 sm:flex-none sm:px-4 transition-colors aria-pressed:bg-ink aria-pressed:text-paper"
        >
          {o.label}
          <span className="text-xs opacity-60 tabular-nums">{o.count}</span>
        </button>
      ))}
    </div>
  );
}
