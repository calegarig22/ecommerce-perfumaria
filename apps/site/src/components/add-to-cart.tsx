"use client";

import { useEffect, useRef, useState } from "react";
import type { Variant } from "@/lib/types";
import { formatPrice, formatSize } from "@/lib/format";
import { useCart } from "./cart";

type Props = {
  slug: string;
  name: string;
  lineName: string;
  variants: Variant[];
};

export function AddToCart({ slug, name, lineName, variants }: Props) {
  const { add, open } = useCart();
  const [sku, setSku] = useState(variants[0]?.sku);
  const [added, setAdded] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const mainButton = useRef<HTMLButtonElement>(null);
  const variant = variants.find((v) => v.sku === sku);

  // Barra fixa de compra no celular: aparece quando o botão principal sai da tela.
  useEffect(() => {
    const el = mainButton.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setBarVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!variant) return null;

  const addToBag = () => {
    add({ sku: variant.sku, slug, name, lineName, size: variant.size, unit: variant.unit, label: variant.label, priceCents: variant.priceCents });
    setAdded(true);
    open();
  };
  const label = variant.inStock ? "Adicionar à sacola" : "Esgotado";
  const price = formatPrice(variant.priceCents) ?? "Preço sob consulta";

  return (
    <div className="space-y-4">
      {variants.length > 1 && (
        <fieldset>
          <legend className="text-sm text-muted">Tamanho</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {variants.map((v) => (
              <label
                key={v.sku}
                className="flex min-h-11 cursor-pointer items-center rounded-sm border border-line px-4 text-sm has-[:checked]:border-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
              >
                <input type="radio" name="variante" value={v.sku} checked={v.sku === sku} onChange={() => setSku(v.sku)} className="sr-only" />
                {formatSize(v.size, v.unit, v.label) || v.sku}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <button ref={mainButton} type="button" className="btn-primary w-full sm:w-auto sm:min-w-64" disabled={!variant.inStock} onClick={addToBag}>
        {label}
      </button>
      <p className="sr-only" role="status">
        {added ? `${name} adicionado à sacola` : ""}
      </p>

      <div
        aria-hidden={!barVisible}
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-300 lg:hidden ${
          barVisible ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl leading-tight">{name}</p>
            <p className="truncate text-sm text-muted">
              {lineName}, {price.toLowerCase()}
            </p>
          </div>
          <button type="button" tabIndex={barVisible ? 0 : -1} className="btn-primary shrink-0 px-5" disabled={!variant.inStock} onClick={addToBag}>
            {variant.inStock ? "Adicionar" : "Esgotado"}
          </button>
        </div>
      </div>
    </div>
  );
}
