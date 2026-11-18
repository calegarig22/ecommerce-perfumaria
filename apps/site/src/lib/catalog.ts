import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@perfumaria/db/schema";
import { seedFragrances, seedLines } from "@perfumaria/db/catalog-seed";
import type { Line, LineSlug, Product } from "./types";

/** Destaques iniciais da home — ajustar no banco (products.featured). */
const FEATURED_SEED = new Set(["aurora-perfume", "brisa-perfume", "bosque-perfume"]);

export { linePhoto } from "@perfumaria/db/line-photos";
import { linePhoto } from "@perfumaria/db/line-photos";

function withDefaultImage(p: Product): Product {
  if (p.images.length) return p;
  const url = linePhoto(p.line.slug, p.gender);
  return url ? { ...p, images: [{ url, alt: `Frasco ${p.line.name} ${p.name}` }] } : p;
}

/**
 * Só categorias com produto à venda aparecem no site, com capa: frasco padrão
 * da linha ou a foto do primeiro produto que tiver foto.
 */
function visibleLines(lines: Omit<Line, "cover">[], products: Product[]): Line[] {
  return lines
    .filter((l) => products.some((p) => p.line.slug === l.slug))
    .map((l) => {
      const firstPhoto = products.find((p) => p.line.slug === l.slug && p.images.length)?.images[0].url;
      return { ...l, cover: linePhoto(l.slug, "feminino") ?? firstPhoto ?? null };
    });
}

export const productSlug = (fragrance: string, line: LineSlug) => `${fragrance}-${line}`;

function fromSeed(): { lines: Line[]; products: Product[] } {
  const lines = seedLines.map(({ slug, name, shortName, description }) => ({ slug, name, shortName, description, cover: null }));
  const bySlug = new Map(lines.map((l) => [l.slug, l]));
  const products: Product[] = [];
  for (const line of seedLines) {
    for (const f of seedFragrances) {
      if (!f.lines.includes(line.slug)) continue;
      const slug = productSlug(f.slug, line.slug);
      products.push({
        slug,
        fragranceSlug: f.slug,
        name: f.name,
        family: f.family,
        gender: f.gender,
        notes: { top: f.top, heart: f.heart, base: f.base },
        description: null,
        line: bySlug.get(line.slug)!,
        variants: [
          {
            sku: `${line.skuPrefix}-${f.slug.toUpperCase()}`,
            size: line.volumeMl,
            unit: line.unit,
            label: null,
            priceCents: null,
            inStock: true,
          },
        ],
        images: [],
        featured: FEATURED_SEED.has(slug),
      });
    }
  }
  const withImages = products.map(withDefaultImage);
  return { lines: visibleLines(lines, withImages), products: withImages };
}

async function fromDb(db: NonNullable<ReturnType<typeof getDb>>) {
  const [lineRows, rows, variantRows, imageRows] = await Promise.all([
    db.select().from(s.productLines).where(eq(s.productLines.active, true)).orderBy(asc(s.productLines.sort), asc(s.productLines.name)),
    db
      .select({
        slug: s.products.slug,
        id: s.products.id,
        featured: s.products.featured,
        lineId: s.products.lineId,
        fragranceSlug: s.fragrances.slug,
        name: s.fragrances.name,
        family: s.fragrances.family,
        gender: s.fragrances.gender,
        top: s.fragrances.notesTop,
        heart: s.fragrances.notesHeart,
        base: s.fragrances.notesBase,
        description: s.fragrances.description,
        // internalReference propositalmente NÃO selecionado.
      })
      .from(s.products)
      .innerJoin(s.fragrances, eq(s.products.fragranceId, s.fragrances.id))
      .where(eq(s.products.active, true))
      .orderBy(asc(s.fragrances.name)),
    db.select().from(s.productVariants).where(eq(s.productVariants.active, true)),
    db.select().from(s.productImages).orderBy(asc(s.productImages.sort)),
  ]);

  const lines: Line[] = lineRows.map((l) => ({
    slug: l.slug,
    name: l.name,
    shortName: l.shortName,
    description: l.description,
    cover: null,
  }));
  const lineById = new Map(lineRows.map((l, i) => [l.id, lines[i]]));
  const lineSort = new Map(lineRows.map((l) => [l.id, l.sort]));

  const products: Product[] = rows
    .filter((r) => lineById.has(r.lineId)) // categoria oculta esconde os produtos dela
    .slice()
    .sort((a, b) => (lineSort.get(a.lineId) ?? 0) - (lineSort.get(b.lineId) ?? 0))
    .map((r) => ({
      slug: r.slug,
      fragranceSlug: r.fragranceSlug,
      name: r.name,
      family: r.family,
      gender: r.gender,
      notes: { top: r.top, heart: r.heart, base: r.base },
      description: r.description,
      line: lineById.get(r.lineId)!,
      variants: variantRows
        .filter((v) => v.productId === r.id)
        .sort((a, b) => (a.size ?? 0) - (b.size ?? 0) || a.id - b.id)
        .map((v) => ({
          sku: v.sku,
          size: v.size,
          unit: v.unit,
          label: v.label,
          priceCents: v.priceCents,
          inStock: v.stock == null || v.stock > 0,
        })),
      images: imageRows.filter((i) => i.productId === r.id).map((i) => ({ url: i.url, alt: i.alt })),
      featured: r.featured,
    }));

  const withImages = products.map(withDefaultImage);
  return { lines: visibleLines(lines, withImages), products: withImages };
}

export async function getCatalog() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const db = getDb();
  return db ? fromDb(db) : fromSeed();
}

export async function getProduct(slug: string) {
  const { products } = await getCatalog();
  return products.find((p) => p.slug === slug) ?? null;
}

/** Mesma fragrância em outras linhas (ex.: Aurora perfume → body splash, cabelo). */
export async function getSiblings(product: Product) {
  const { products } = await getCatalog();
  return products.filter((p) => p.fragranceSlug === product.fragranceSlug);
}

/** Mesma família principal, na mesma categoria (sem família: só a mesma categoria). */
export async function getRelated(product: Product, limit = 4) {
  const { products } = await getCatalog();
  const main = product.family.split(" ")[0];
  return products
    .filter(
      (p) =>
        p.slug !== product.slug &&
        p.line.slug === product.line.slug &&
        p.gender === product.gender &&
        p.family.split(" ")[0] === main,
    )
    .slice(0, limit);
}
