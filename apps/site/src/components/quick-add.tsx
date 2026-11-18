"use client";

import type { Product } from "@/lib/types";
import { useCart } from "./cart";

/** Botão discreto (ícone de sacola) sobre a foto do card. */
export function QuickAdd({ product }: { product: Product }) {
  const { add, open } = useCart();
  const v = product.variants[0];
  if (!v || !v.inStock) return null;
  return (
    <button
      type="button"
      onClick={() => {
        add({
          sku: v.sku,
          slug: product.slug,
          name: product.name,
          lineName: product.line.name,
          size: v.size,
          unit: v.unit,
          label: v.label,
          priceCents: v.priceCents,
        });
        open();
      }}
      className="grid size-11 place-items-center rounded-pill bg-paper/90 text-ink shadow-[0_4px_14px_-6px_rgb(46_36_32/0.35)] backdrop-blur transition-[transform,background-color,color] duration-300 hover:bg-ink hover:text-paper"
      aria-label={`Adicionar ${product.name} ${product.line.name} à sacola`}
    >
      <svg viewBox="0 0 24 24" className="size-[1.15rem]" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
        <path d="M5 8h14l-1.2 12H6.2L5 8z" />
        <path d="M9 8V6.5a3 3 0 016 0V8" />
        <path d="M12 11.5v5M9.5 14h5" />
      </svg>
    </button>
  );
}
