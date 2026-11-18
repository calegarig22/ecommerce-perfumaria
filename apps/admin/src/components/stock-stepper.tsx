"use client";

import { useOptimistic, useState, useTransition } from "react";
import { adjustStock } from "@/lib/actions/catalog";

/** Estoque com botões − / + grandes (bons no celular). − = vendi um; + = chegou um. */
export function StockStepper({ variantId, stock, low, label }: { variantId: number; stock: number; low: number; label: string }) {
  const [value, setValue] = useState(stock);
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const change = (delta: 1 | -1) =>
    start(async () => {
      setError(null);
      setOptimistic(Math.max(0, optimistic + delta));
      const res = await adjustStock(variantId, delta);
      if (res.ok && res.stock != null) setValue(res.stock);
      else setError(res.message ?? "Não deu para salvar.");
    });

  const tone = optimistic === 0 ? "text-danger" : optimistic <= low ? "text-warn" : "";
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => change(-1)}
        disabled={optimistic === 0}
        className="grid size-9 place-items-center rounded-md border border-line-strong text-lg leading-none hover:bg-nude disabled:opacity-40"
        aria-label={`Tirar 1 do estoque de ${label} (vendi)`}
      >
        −
      </button>
      <span className={`w-12 text-center text-sm font-medium tabular-nums ${tone}`} aria-live="polite">
        {optimistic === 0 ? "esgot." : `${optimistic} un.`}
      </span>
      <button
        type="button"
        onClick={() => change(1)}
        className="grid size-9 place-items-center rounded-md border border-line-strong text-lg leading-none hover:bg-nude"
        aria-label={`Somar 1 ao estoque de ${label} (chegou)`}
      >
        +
      </button>
      {error && <span role="alert" className="ml-1 text-xs text-danger">{error}</span>}
    </div>
  );
}
