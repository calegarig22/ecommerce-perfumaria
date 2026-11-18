"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { applyImport, previewImport, type PreviewState } from "@/lib/actions/import";
import { compressImage } from "@/lib/image-client";
import type { PlanKind } from "@/lib/import/plan";

const KIND: Record<PlanKind, { label: string; cls: string }> = {
  "novo-produto": { label: "Novo", cls: "bg-ok/10 text-ok" },
  "novo-tamanho": { label: "Novo tamanho", cls: "bg-ok/10 text-ok" },
  atualizar: { label: "Muda", cls: "bg-caramel/20 text-accent-deep" },
  igual: { label: "Sem mudança", cls: "bg-nude text-muted" },
  erro: { label: "Problema", cls: "bg-danger/10 text-danger" },
};

export function ImportClient({ aiOn }: { aiOn: boolean }) {
  const [mode, setMode] = useState<"planilha" | "ia">(aiOn ? "ia" : "planilha");
  const [preview, previewAction, reading] = useActionState(previewImport, null as PreviewState);
  const [applied, applyAction, applying] = useActionState(applyImport, null);
  const [, start] = useTransition();
  const [preparing, setPreparing] = useState(false);
  const [showSame, setShowSame] = useState(false);

  const busy = reading || preparing;

  return (
    <div className="space-y-6">
      {/* Com IA ativa: escolher entre ler foto/PDF/texto ou planilha (botões simples, não abas). */}
      {aiOn && (
        <div role="radiogroup" aria-label="Ler de onde" className="flex flex-wrap gap-2">
          {[
            { v: "ia" as const, t: "Foto, PDF ou texto (IA)" },
            { v: "planilha" as const, t: "Planilha" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={mode === o.v}
              onClick={() => setMode(o.v)}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm ${
                mode === o.v ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink"
              }`}
            >
              {o.t}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const f = fd.get("file");
          start(async () => {
            // Fotos de celular são reduzidas antes do envio (mais rápido e dentro do limite).
            if (mode === "ia" && f instanceof File && f.size > 0 && f.type.startsWith("image/")) {
              setPreparing(true);
              try {
                fd.set("file", await compressImage(f));
              } catch {
                /* envia como está; o servidor avisa se não der */
              }
              setPreparing(false);
            }
            previewAction(fd);
          });
        }}
        className="card space-y-4 p-5"
      >
        <input type="hidden" name="mode" value={mode} />
        {mode === "planilha" ? (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>
                Baixe{" "}
                <a href="/exportar" className="text-accent hover:underline">a planilha com todos os produtos</a> (para mudar preços e estoque) ou{" "}
                <a href="/exportar?modelo=1" className="text-accent hover:underline">o modelo vazio</a> (para cadastrar novos).
              </li>
              <li>Abra no Excel ou no Google Planilhas e edite. Célula vazia = não mexe.</li>
              <li>Salve como CSV e envie aqui. Eu mostro o que vai mudar antes de salvar.</li>
            </ol>
            <div>
              <label className="label" htmlFor="file-csv">Arquivo da planilha (.csv)</label>
              <input id="file-csv" name="file" type="file" accept=".csv,text/csv,.xlsx,.xls" required className="text-sm" />
            </div>
          </>
        ) : !aiOn ? (
          <p className="rounded-md bg-nude p-3 text-sm">
            A leitura por IA ainda não está ativada neste painel (falta configurar a chave do Gemini). Enquanto isso, use a planilha.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Mande uma <strong>foto da lista de preços</strong> (pode ser escrita à mão), o <strong>catálogo em PDF</strong>, a{" "}
              <strong>foto do rótulo</strong> ou <strong>cole o texto</strong> (ex.: legenda do Instagram). A IA monta a lista e você confere antes de salvar.
            </p>
            <div>
              <label className="label" htmlFor="file-ia">Foto ou PDF</label>
              <input id="file-ia" name="file" type="file" accept="image/*,application/pdf" className="text-sm" />
            </div>
            <div>
              <label className="label" htmlFor="text">Ou cole o texto</label>
              <textarea
                id="text"
                name="text"
                rows={4}
                maxLength={20000}
                placeholder={"Ex.:\nVela Brisa 180g — R$ 59,90 (10 unidades)\nHome spray Brisa 250 ml — R$ 49,90"}
                className="field"
              />
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={busy || (mode === "ia" && !aiOn)}>
            {preparing ? "Preparando foto…" : reading ? (mode === "ia" ? "Lendo com IA… (até 1 min)" : "Lendo…") : "Ler e mostrar o que muda"}
          </button>
          {preview && !preview.ok && !busy && <p role="alert" className="text-sm text-danger">{preview.message}</p>}
        </div>
      </form>

      {preview?.ok && !applied?.ok && (
        <section aria-labelledby="revisao" className="card p-5">
          <h2 id="revisao" className="font-display text-xl">Confira antes de salvar</h2>
          <p className="mt-1 text-sm text-muted">
            {preview.plan.counts["novo-produto"]} novo(s) · {preview.plan.counts["novo-tamanho"]} novo(s) tamanho(s) · {preview.plan.counts.atualizar} com mudança ·{" "}
            {preview.plan.counts.igual} sem mudança · {preview.plan.counts.erro} com problema
          </p>
          {preview.plan.newCategories.length > 0 && (
            <p className="mt-2 rounded-md bg-caramel/15 p-2 text-sm">
              Categorias novas que serão criadas: <strong>{preview.plan.newCategories.join(", ")}</strong>. Se era para ser uma existente, corrija o nome e leia de novo.
            </p>
          )}
          {preview.messages.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-warn">
              {preview.messages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          <ul className="mt-4 divide-y divide-line">
            {preview.plan.items
              .filter((it) => showSame || it.kind !== "igual")
              .map((it) => (
                <li key={it.row} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2 text-sm">
                  <span className={`badge ${KIND[it.kind].cls}`}>{KIND[it.kind].label}</span>
                  <span className="min-w-0 flex-1">
                    <strong>{it.title}</strong> <span className="text-muted">· {it.category || "sem categoria"}{it.newCategory ? " (nova)" : ""}</span>
                    {it.changes.length > 0 && <span className="block text-xs text-muted">{it.changes.join(" · ")}</span>}
                    {it.warn && <span className={`block text-xs ${it.kind === "erro" ? "text-danger" : "text-warn"}`}>{it.warn}</span>}
                  </span>
                </li>
              ))}
          </ul>
          {preview.plan.counts.igual > 0 && (
            <button type="button" className="mt-2 text-sm text-accent hover:underline" onClick={() => setShowSame((v) => !v)}>
              {showSame ? "Esconder" : "Mostrar"} os {preview.plan.counts.igual} sem mudança
            </button>
          )}

          <form action={applyAction} className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <input type="hidden" name="rows" value={JSON.stringify(preview.rows)} />
            <input type="hidden" name="source" value={preview.source} />
            {preview.plan.counts["novo-produto"] > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="publishNew" defaultChecked className="size-5" />
                Colocar os novos à venda já
              </label>
            )}
            <button
              type="submit"
              className="btn-primary"
              disabled={applying || preview.plan.counts.erro + preview.plan.counts.igual === preview.plan.items.length}
            >
              {applying ? "Salvando…" : "Salvar tudo"}
            </button>
            {applied && !applied.ok && <p role="alert" className="text-sm text-danger">{applied.message}</p>}
          </form>
        </section>
      )}

      {applied?.ok && (
        <section className="card border-ok/40 p-5">
          <p role="status" className="text-ok">{applied.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!!applied.createdIds?.length && (
              <Link href="/produtos/novo?modo=fotos" className="btn-primary">Pôr fotos nos novos</Link>
            )}
            <Link href="/produtos" className="btn-secondary">Ver produtos</Link>
            <button type="button" className="btn-secondary" onClick={() => location.reload()}>Importar outro</button>
          </div>
        </section>
      )}
    </div>
  );
}
