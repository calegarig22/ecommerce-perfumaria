"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { Product } from "@/lib/types";
import Image from "next/image";
import { NotesPyramid } from "./notes";

/** Destaque da home: escolha uma fragrância e o frasco troca de camadas. */
export function HeroFeature({ products }: { products: Product[] }) {
  const [active, setActive] = useState(0);
  const base = useId();
  const p = products[active];
  if (!p) return null;

  return (
    <div className="min-w-0 rounded-sm bg-nude px-4 pb-6 pt-4 sm:px-8 sm:pb-8 sm:pt-5">
      <div role="tablist" aria-label="Fragrâncias em destaque" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {products.map((item, i) => (
          <button
            key={item.slug}
            id={`${base}-tab-${i}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls={`${base}-panel`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              const next = (i + (e.key === "ArrowRight" ? 1 : -1) + products.length) % products.length;
              setActive(next);
              document.getElementById(`${base}-tab-${next}`)?.focus();
            }}
            className="min-h-11 shrink-0 rounded-sm px-4 text-sm text-ink/70 transition-colors hover:text-ink aria-selected:bg-paper aria-selected:text-ink"
          >
            {item.name}
          </button>
        ))}
      </div>

      <div
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={`${base}-tab-${active}`}
        className="mt-4 grid grid-cols-[minmax(0,1fr)] items-end gap-5 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] sm:gap-6"
      >
        {p.images[0] && (
          <div className="relative mx-auto aspect-[4/5] w-full max-w-[10rem] sm:max-w-[14rem]">
            <Image
              key={p.slug}
              src={p.images[0].url}
              alt={p.images[0].alt}
              fill
              priority
              sizes="(min-width: 640px) 224px, 160px"
              className={`hero-photo object-contain drop-shadow-[0_20px_24px_rgb(46_36_32/0.2)] ${
                p.line.slug === "perfume-cabelo" ? "object-left-bottom" : "object-bottom"
              }`}
            />
          </div>
        )}
        <div>
          <p className="text-sm text-muted">
            {[p.line.name, p.family.toLowerCase()].filter(Boolean).join(", ")}
          </p>
          <p className="mt-1 font-display text-4xl leading-none sm:text-[2.6rem]">{p.name}</p>
          <div className="mt-5">
            <NotesPyramid notes={p.notes} family={p.family} compact />
          </div>
          <Link href={`/loja/${p.slug}`} className="link-quiet mt-4 inline-flex min-h-11 items-center text-sm">
            Conhecer {p.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
