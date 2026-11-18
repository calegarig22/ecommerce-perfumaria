"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { compressImage, fileLabel } from "@/lib/image-client";
import { uploadImage } from "@/lib/actions/catalog";

type Option = { id: number; name: string; line: string; lineShort: string; photos: number; hasDefault: boolean };
type Item = { key: string; file: File; preview: string; productId: number | ""; status: "pronta" | "enviando" | "enviada" | "erro"; msg?: string };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Adivinha o produto pelo nome do arquivo: precisa conter o nome do produto; a categoria desempata. */
function guess(fileName: string, options: Option[]): number | "" {
  const f = ` ${norm(fileLabel(fileName))} `;
  let best: { id: number; score: number } | null = null;
  for (const o of options) {
    const name = norm(o.name);
    if (!name || !f.includes(` ${name} `)) continue;
    let score = name.length * 10;
    for (const w of norm(`${o.line} ${o.lineShort}`).split(" ")) if (w.length > 2 && f.includes(` ${w} `)) score += 5;
    if (o.photos === 0) score += 1; // empate: prefere quem ainda está sem foto
    if (!best || score > best.score) best = { id: o.id, score };
  }
  return best?.id ?? "";
}

export function BulkPhotos({ options }: { options: Option[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, start] = useTransition();
  const [dragging, setDragging] = useState(false);

  const add = (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)).slice(0, 60);
    setItems((cur) => [
      ...cur,
      ...imgs.map((file) => ({
        key: `${file.name}-${file.size}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
        productId: guess(file.name, options),
        status: "pronta" as const,
      })),
    ]);
  };
  const set = (key: string, patch: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const ready = items.filter((i) => i.status !== "enviada" && i.productId !== "");
  const sendAll = () =>
    start(async () => {
      for (const it of ready) {
        set(it.key, { status: "enviando", msg: undefined });
        try {
          const small = await compressImage(it.file);
          const o = options.find((x) => x.id === it.productId);
          const fd = new FormData();
          fd.set("file", small);
          fd.set("alt", o ? `${o.lineShort} ${o.name}` : "");
          const res = await uploadImage(Number(it.productId), null, fd);
          set(it.key, res?.ok ? { status: "enviada" } : { status: "erro", msg: res?.message ?? "Falha no envio." });
        } catch (e) {
          set(it.key, { status: "erro", msg: (e as Error).message });
        }
      }
      router.refresh();
    });

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add([...e.dataTransfer.files]);
        }}
        className={`card border-2 border-dashed p-8 text-center ${dragging ? "border-accent bg-nude" : "border-line-strong"}`}
      >
        <input id="lote" type="file" accept="image/*" multiple className="sr-only" onChange={(e) => add([...(e.target.files ?? [])])} />
        <label htmlFor="lote" className="btn-primary">Escolher fotos</label>
        <p className="mt-3 text-sm text-muted">
          Ou arraste várias para cá. Dica: se o nome do arquivo tiver o nome do produto (ex.: <em>aurora perfume.jpg</em>), eu já ligo sozinho.
        </p>
      </div>

      {items.length > 0 && (
        <>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((it) => (
              <li key={it.key} className="card flex gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:), não passa pelo otimizador */}
                <img src={it.preview} alt="" className="size-20 shrink-0 rounded-sm bg-nude object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted" title={it.file.name}>{it.file.name}</p>
                  <label className="sr-only" htmlFor={`p-${it.key}`}>Produto da foto {it.file.name}</label>
                  <select
                    id={`p-${it.key}`}
                    value={it.productId}
                    disabled={it.status === "enviada" || busy}
                    onChange={(e) => set(it.key, { productId: e.target.value ? Number(e.target.value) : "" })}
                    className={`field mt-1 py-1.5 ${it.productId === "" ? "border-warn" : ""}`}
                  >
                    <option value="">Escolha o produto…</option>
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} · {o.lineShort}
                        {o.photos > 0 ? "" : o.hasDefault ? " (foto padrão)" : " (sem foto)"}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span
                      className={
                        it.status === "enviada" ? "text-ok" : it.status === "erro" ? "text-danger" : it.status === "enviando" ? "text-accent" : "text-muted"
                      }
                    >
                      {it.status === "enviada" ? "✓ Enviada" : it.status === "enviando" ? "Enviando…" : it.status === "erro" ? it.msg : "Pronta"}
                    </span>
                    {it.status !== "enviada" && !busy && (
                      <button type="button" className="text-muted hover:text-danger" onClick={() => setItems((c) => c.filter((x) => x.key !== it.key))}>
                        Tirar
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="sticky bottom-20 mt-6 flex flex-wrap items-center gap-3 rounded-md bg-paper/95 py-2 backdrop-blur md:bottom-4">
            {!busy && items.every((i) => i.status === "enviada") ? (
              <>
                <p role="status" className="text-sm text-ok">✓ Todas as fotos enviadas. O site já mostra.</p>
                <button type="button" className="btn-secondary" onClick={() => setItems([])}>Enviar mais</button>
              </>
            ) : (
              <button type="button" className="btn-primary" disabled={busy || !ready.length} onClick={sendAll}>
                {busy ? "Enviando…" : `Enviar ${ready.length} foto(s)`}
              </button>
            )}
            {items.some((i) => i.productId === "" && i.status !== "enviada") && (
              <p className="text-sm text-warn">Escolha o produto das fotos marcadas.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
