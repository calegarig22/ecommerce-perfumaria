"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { compressImage } from "@/lib/image-client";
import { createFragrance } from "@/lib/actions/catalog";

type Line = { id: number; name: string; slug: string; unit: string };

const UNIT: Record<string, string> = { ml: "ml", g: "g", un: "unid." };
/** Categorias de perfumaria: nelas o público (feminino/masculino) importa para os filtros do site. */
const PERFUMARIA = new Set(["perfume", "body-splash", "perfume-cabelo"]);
const DEFAULT_SIZE: Record<string, string> = { "body-splash": "220" };

type Photo = { file: File; url: string };

export function NewProductForm({ lines, pre }: { lines: Line[]; pre: string }) {
  const [state, formAction, pending] = useActionState(createFragrance, null);
  const [, start] = useTransition();
  const [selected, setSelected] = useState<Set<number>>(() => new Set(lines.filter((l) => l.slug === pre).map((l) => l.id)));
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  const perfumaria = lines.some((l) => selected.has(l.id) && PERFUMARIA.has(l.slug));
  const toggle = (id: number) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function addPhotos(files: File[]) {
    setPreparing(true);
    setPhotoError(null);
    const ready: Photo[] = [];
    for (const f of files.slice(0, 8 - photos.length)) {
      try {
        const small = await compressImage(f);
        ready.push({ file: small, url: URL.createObjectURL(small) });
      } catch (e) {
        setPhotoError((e as Error).message);
      }
    }
    setPhotos((cur) => [...cur, ...ready]);
    setPreparing(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.delete("photos-picker");
        for (const p of photos) fd.append("photos", p.file);
        start(() => formAction(fd));
      }}
      className="space-y-5"
    >
      {/* 1. Fotos */}
      <section className="card p-5">
        <h2 className="font-display text-xl">1. Fotos <span className="text-sm font-normal text-muted">(opcional, pode pôr depois)</span></h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {photos.map((p, i) => (
            <div key={p.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) */}
              <img src={p.url} alt={`Foto ${i + 1}`} className="size-24 rounded-md bg-nude object-cover" />
              {i === 0 && <span className="badge absolute top-1 left-1 bg-ink text-paper">Principal</span>}
              <button
                type="button"
                onClick={() => setPhotos((cur) => cur.filter((x) => x !== p))}
                className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full border border-line bg-paper text-sm shadow"
                aria-label={`Tirar foto ${i + 1}`}
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < 8 && (
            <label className="grid size-24 place-items-center rounded-md border-2 border-dashed border-line-strong text-center text-xs text-muted hover:border-accent">
              <input
                type="file"
                name="photos-picker"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  void addPhotos([...(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
              {preparing ? "Preparando…" : <span>+<br />Foto</span>}
            </label>
          )}
        </div>
        {photoError && <p role="alert" className="mt-2 text-sm text-danger">{photoError}</p>}
        <p className="mt-2 text-xs text-muted">No celular dá para tirar a foto na hora. A primeira é a principal.</p>
      </section>

      {/* 2. O que é */}
      <section className="card p-5">
        <h2 className="font-display text-xl">2. Nome</h2>
        <label className="label mt-3" htmlFor="name">Como aparece no site</label>
        <input id="name" name="name" required maxLength={60} placeholder="Ex.: Aurora, Brisa, Lavanda Francesa" className="field text-base" />
        <label className="label mt-4" htmlFor="description">Descrição curta <span className="font-normal text-muted">(opcional)</span></label>
        <textarea id="description" name="description" rows={3} maxLength={1200} placeholder="Ex.: Vela de cera vegetal, 40 horas de queima." className="field" />
      </section>

      {/* 3. Onde vender */}
      <section className="card p-5">
        <h2 className="font-display text-xl">3. Categoria, tamanho e preço</h2>
        <p className="mt-1 text-xs text-muted">Toque em uma ou mais. Preço vazio = “sob consulta”. Estoque vazio = sob encomenda.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {lines.map((l) => {
            const on = selected.has(l.id);
            return (
              <label
                key={l.id}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm ${
                  on ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink"
                }`}
              >
                <input type="checkbox" name={`line-${l.id}`} checked={on} onChange={() => toggle(l.id)} className="sr-only" />
                {on ? "✓ " : ""}
                {l.name}
              </label>
            );
          })}
        </div>
        <div className="mt-4 space-y-3">
          {lines
            .filter((l) => selected.has(l.id))
            .map((l) => (
              <fieldset key={l.id} className="rounded-md border border-line p-3">
                <legend className="px-1 text-sm font-medium">{l.name}</legend>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="label" htmlFor={`line-${l.id}-size`}>Tamanho ({UNIT[l.unit] ?? l.unit})</label>
                    <input id={`line-${l.id}-size`} name={`line-${l.id}-size`} defaultValue={DEFAULT_SIZE[l.slug] ?? ""} inputMode="numeric" className="field w-28" />
                  </div>
                  <div>
                    <label className="label" htmlFor={`line-${l.id}-price`}>Preço (R$)</label>
                    <input id={`line-${l.id}-price`} name={`line-${l.id}-price`} placeholder="89,90" inputMode="decimal" className="field w-32" />
                  </div>
                  <div>
                    <label className="label" htmlFor={`line-${l.id}-stock`}>Estoque</label>
                    <input id={`line-${l.id}-stock`} name={`line-${l.id}-stock`} placeholder="encomenda" inputMode="numeric" className="field w-28" />
                  </div>
                </div>
              </fieldset>
            ))}
        </div>
        <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-md border border-line p-3">
          <span>
            <span className="block text-sm font-medium">À venda no site</span>
            <span className="block text-xs text-muted">Desligue para cadastrar escondido e publicar depois.</span>
          </span>
          <input type="checkbox" name="active" defaultChecked className="peer sr-only" />
          <span
            aria-hidden
            className="relative h-7 w-12 shrink-0 rounded-full bg-line-strong transition-colors after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-paper after:shadow after:transition-transform peer-checked:bg-ink peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
          />
        </label>
        {perfumaria ? (
          <div className="mt-4">
            <label className="label" htmlFor="gender">Público</label>
            <select id="gender" name="gender" defaultValue="feminino" className="field w-auto">
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
              <option value="unissex">Unissex</option>
            </select>
          </div>
        ) : (
          <input type="hidden" name="gender" value="" />
        )}
      </section>

      {/* Avançado */}
      <details className="card p-5">
        <summary className="font-display text-lg">Mais detalhes <span className="text-sm font-normal text-muted">(opcional: notas olfativas, família, referência interna)</span></summary>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="family">Família olfativa</label>
            <input id="family" name="family" maxLength={80} placeholder="Floral Frutado" className="field" />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="internalReference">Referência interna (só no painel)</label>
            <input id="internalReference" name="internalReference" maxLength={120} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="notesTop">Notas de saída</label>
            <textarea id="notesTop" name="notesTop" rows={2} placeholder="Bergamota, Pera" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="notesHeart">Notas de coração</label>
            <textarea id="notesHeart" name="notesHeart" rows={2} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="notesBase">Notas de fundo</label>
            <textarea id="notesBase" name="notesBase" rows={2} className="field" />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">Separe as notas por vírgula.</p>
      </details>

      <div className="sticky bottom-16 z-10 -mx-4 flex items-center justify-end gap-4 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
        <p role={state && !state.ok && !pending ? "alert" : undefined} className={`mr-auto text-sm ${state && !state.ok && !pending ? "text-danger" : "text-muted"}`}>
          {state && !state.ok && !pending ? state.message : !selected.size ? "Escolha a categoria no passo 3." : ""}
        </p>
        <button type="submit" className="btn-primary px-8" disabled={pending || preparing || !selected.size}>
          {pending ? "Salvando…" : "Criar produto"}
        </button>
      </div>
    </form>
  );
}
