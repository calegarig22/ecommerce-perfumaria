import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/add-to-cart";
import { ProductImage } from "@/components/product-image";
import { NotesPyramid } from "@/components/notes";
import { ProductCard } from "@/components/product-card";
import { getCatalog, getProduct, getRelated, getSiblings } from "@/lib/catalog";
import { genderLabel, mainSize, priceLabel } from "@/lib/format";
import { whatsappLink } from "@/lib/site";

const SLUG = /^[a-z0-9-]{1,80}$/;

export async function generateStaticParams() {
  const { products } = await getCatalog();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/loja/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = SLUG.test(slug) ? await getProduct(slug) : null;
  if (!p) return { title: "Produto não encontrado" };
  const notes = [...p.notes.top, ...p.notes.heart, ...p.notes.base].slice(0, 5).join(", ");
  const kind = [p.line.name.toLowerCase(), p.family.toLowerCase()].filter(Boolean).join(" ");
  return {
    title: `${p.name} ${p.line.name}`,
    description: `${p.name}, ${kind} da Perfumaria Exemplo.${notes ? ` Notas de ${notes}.` : ""}`,
  };
}

export default async function ProductPage({ params }: PageProps<"/loja/[slug]">) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const product = await getProduct(slug);
  if (!product) notFound();

  const [siblings, related] = await Promise.all([getSiblings(product), getRelated(product)]);
  const image = product.images[0];
  const size = mainSize(product.variants);
  const profile = [product.family, product.gender && genderLabel[product.gender].toLowerCase()].filter(Boolean).join(", ");
  const hasNotes = product.notes.top.length + product.notes.heart.length + product.notes.base.length > 0;

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 sm:pt-6 lg:px-10">
        <nav aria-label="Você está em" className="text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-x-2">
            <li>
              <Link href="/loja" className="link-quiet -mx-2 inline-flex min-h-11 items-center px-2">
                Loja
              </Link>
              <span aria-hidden className="ml-2">/</span>
            </li>
            <li>
              <Link href={`/loja?linha=${product.line.slug}`} className="link-quiet inline-flex min-h-11 items-center">
                {product.line.name}
              </Link>
              <span aria-hidden className="ml-2">/</span>
            </li>
            <li aria-current="page" className="text-ink">
              {product.name}
            </li>
          </ol>
        </nav>
      </div>

      <article className="mx-auto grid max-w-7xl gap-8 sm:gap-10 px-4 pb-28 pt-2 sm:px-6 sm:pt-6 md:grid-cols-2 md:gap-10 lg:gap-16 lg:px-10 lg:pb-28">
        <div className="md:sticky md:top-24 md:self-start lg:top-28">
          <ProductImage
              src={image?.url}
              alt={image?.alt ?? ""}
              name={product.name}
              line={product.line.slug}
              family={product.family}
              notes={product.notes}
              priority
              aspect="aspect-square sm:aspect-[4/5]"
              sizes="(min-width: 768px) 45vw, 100vw"
            />
        </div>

        <div className="md:pt-2 lg:pt-6">
          <p className="text-sm text-muted">
            {product.line.name}
            {size ? `, ${size}` : ""}
          </p>
          <h1 className="mt-2 font-display display-tight text-[clamp(2.75rem,8vw,5.5rem)]">{product.name}</h1>
          {profile && <p className="mt-3 text-lg text-ink/80">{profile}</p>}
          <p className="mt-6 text-xl">{priceLabel(product.variants)}</p>

          {product.description && <p className="measure mt-6 leading-relaxed text-ink/80">{product.description}</p>}

          <div className="mt-8">
            <AddToCart slug={product.slug} name={product.name} lineName={product.line.name} variants={product.variants} />
            <a
              href={whatsappLink(`Olá! Tenho uma dúvida sobre ${product.name} (${product.line.name}).`)}
              target="_blank"
              rel="noopener noreferrer"
              className="link-quiet mt-3 inline-flex min-h-11 items-center text-sm"
            >
              Tirar dúvida pelo WhatsApp
            </a>
          </div>

          {siblings.length > 1 && (
            <div className="mt-10">
              <h2 className="text-sm text-muted">{product.name} também em</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {siblings.map((s) => (
                  <li key={s.slug}>
                    {s.slug === product.slug ? (
                      <span aria-current="page" className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm text-paper">
                        {s.line.name}
                      </span>
                    ) : (
                      <Link
                        href={`/loja/${s.slug}`}
                        className="inline-flex min-h-11 items-center rounded-pill border border-line-strong px-5 text-sm hover:border-ink"
                      >
                        {s.line.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasNotes && (
          <section aria-labelledby="notas" className="mt-12">
            <h2 id="notas" className="font-display text-3xl">
              Notas olfativas
            </h2>
            <p className="mt-2 text-sm text-muted">
              Da primeira impressão ao que permanece: saída, coração e fundo.
            </p>
            <div className="mt-6">
              <NotesPyramid notes={product.notes} family={product.family} />
            </div>
          </section>
          )}
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="relacionados" className="border-t border-line bg-linen">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
            <h2 id="relacionados" className="font-display text-3xl">
              Se você gosta de {product.name}
            </h2>
            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-4">
              {related.map((p) => (
                <li key={p.slug}>
                  <ProductCard product={p} showLine={false} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
