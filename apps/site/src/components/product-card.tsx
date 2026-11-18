import Link from "next/link";
import type { Product } from "@/lib/types";
import { keyNotes, mainSize, priceLabel } from "@/lib/format";
import { ProductImage } from "./product-image";
import { QuickAdd } from "./quick-add";

/** Card no estilo maison: foto, nome em versalete, família, notas e preço. */
export function ProductCard({
  product,
  showLine = true,
  quickAdd = true,
}: {
  product: Product;
  showLine?: boolean;
  quickAdd?: boolean;
}) {
  const image = product.images[0];
  const size = mainSize(product.variants);
  const notes = keyNotes(product.notes);
  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative">
      <Link href={`/loja/${product.slug}`} tabIndex={-1} aria-hidden className="block">
        <ProductImage
            src={image?.url}
            alt={image?.alt ?? ""}
            name={product.name}
            line={product.line.slug}
            family={product.family}
            notes={product.notes}
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"
            imageClassName="transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
          />
      </Link>
      {quickAdd && (
        <div className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 lg:opacity-0 lg:transition-opacity lg:duration-300 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
          <QuickAdd product={product} />
        </div>
      )}
      </div>
      <Link href={`/loja/${product.slug}`} className="block focus-visible:outline-offset-4">
        <div className="mt-5 text-center">
          {showLine && (
            <p className="label-caps text-[0.62rem] text-ink/55">
              {product.line.name}
              {size ? `, ${size}` : ""}
            </p>
          )}
          <h3 className="mt-2 font-display text-[1.05rem] uppercase leading-snug tracking-[0.12em] sm:text-[1.15rem]">
            {product.name}
          </h3>
          {product.family && <p className="mt-1.5 text-[0.82rem] text-ink/60">{product.family}</p>}
          {notes.length > 0 && (
            <p className="mx-auto mt-1 line-clamp-1 max-w-[95%] text-[0.82rem] italic text-ink/55">{notes.join(", ")}</p>
          )}
          <p className="mt-3 text-[0.9rem]">{priceLabel(product.variants)}</p>
        </div>
      </Link>
    </article>
  );
}
