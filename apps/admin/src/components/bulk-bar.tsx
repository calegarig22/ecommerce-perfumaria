"use client";

import { useActionState, useState } from "react";
import { bulkProducts } from "@/lib/actions/catalog";

/**
 * Barra de ações em lote. As caixinhas de cada produto ficam na lista e apontam para
 * este formulário pelo atributo form="lote".
 */
export function BulkBar() {
  const [state, action, pending] = useActionState(bulkProducts, null);
  const [op, setOp] = useState("");

  // As caixinhas da lista continuam ligadas ao formulário mesmo com o painel recolhido (atributo form).
  const toggleAll = (on: boolean) =>
    document.querySelectorAll<HTMLInputElement>('input[form="lote"][name="ids"]').forEach((c) => (c.checked = on));

  return (
    <details className="card mb-4 p-3">
      <summary className="text-sm text-accent">Ações em vários produtos (colocar à venda, esconder, reajustar preço…)</summary>
    <form id="lote" action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="flex gap-2 self-center text-sm">
        <button type="button" className="text-accent hover:underline" onClick={() => toggleAll(true)}>Marcar todos</button>
        <span className="text-muted">·</span>
        <button type="button" className="text-accent hover:underline" onClick={() => toggleAll(false)}>Desmarcar</button>
      </div>
      <div>
        <label htmlFor="op" className="label">Com os marcados</label>
        <select id="op" name="op" value={op} onChange={(e) => setOp(e.target.value)} className="field">
          <option value="">Escolha…</option>
          <option value="publicar">Colocar à venda</option>
          <option value="ocultar">Esconder do site</option>
          <option value="destacar">Destacar na página inicial</option>
          <option value="tirar-destaque">Tirar do destaque</option>
          <option value="reajustar">Reajustar preço (%)</option>
        </select>
      </div>
      {op === "reajustar" && (
        <div>
          <label htmlFor="pct" className="label">Reajuste (%)</label>
          <input id="pct" name="pct" inputMode="decimal" placeholder="10 ou -5" className="field w-28" />
        </div>
      )}
      <button type="submit" className="btn-secondary" disabled={pending || !op}>
        {pending ? "Aplicando…" : "Aplicar"}
      </button>
      {state && !pending && (
        <p role={state.ok ? "status" : "alert"} className={`basis-full text-sm ${state.ok ? "text-ok" : "text-danger"}`}>
          {state.message}
        </p>
      )}
    </form>
    </details>
  );
}
