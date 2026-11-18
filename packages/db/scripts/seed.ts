/**
 * Carrega o catálogo inicial (src/catalog-seed.ts) no banco.
 *
 * Seguro de rodar quantas vezes quiser: só INSERE o que ainda não existe
 * (por slug/SKU). Nunca sobrescreve nomes, notas, preços ou estoque que
 * você editou pelo painel.
 *
 * Uso: pnpm db:seed   (lê DATABASE_URL_MIGRATIONS de packages/db/.env.local)
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import * as s from "../src/schema";
import { seedFragrances, seedLines } from "../src/catalog-seed";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL_MIGRATIONS;
if (!url) {
  console.error("Defina DATABASE_URL_MIGRATIONS em .env.local (ou rode pnpm neon:setup).");
  process.exit(1);
}

const db = drizzle({ client: neon(url), schema: s });
const FEATURED = new Set(["aurora-perfume", "brisa-perfume", "bosque-perfume"]);

/** Insere se não existir; devolve o id (novo ou existente). */
async function ensureLine(l: (typeof seedLines)[number]) {
  await db
    .insert(s.productLines)
    .values({ slug: l.slug, name: l.name, shortName: l.shortName, skuPrefix: l.skuPrefix, description: l.description, unit: l.unit, sort: l.sort })
    .onConflictDoNothing({ target: s.productLines.slug });
  const [row] = await db.select({ id: s.productLines.id }).from(s.productLines).where(eq(s.productLines.slug, l.slug));
  return row.id;
}

async function main() {
  const before = await count();
  const lineIds = new Map<string, number>();
  for (const l of seedLines) lineIds.set(l.slug, await ensureLine(l));

  for (const f of seedFragrances) {
    await db
      .insert(s.fragrances)
      .values({
        slug: f.slug,
        name: f.name,
        family: f.family,
        gender: f.gender,
        notesTop: f.top,
        notesHeart: f.heart,
        notesBase: f.base,
        internalReference: f.internalReference,
      })
      .onConflictDoNothing({ target: s.fragrances.slug });
    const [frag] = await db.select({ id: s.fragrances.id }).from(s.fragrances).where(eq(s.fragrances.slug, f.slug));

    for (const lineSlug of f.lines) {
      const line = seedLines.find((l) => l.slug === lineSlug)!;
      const slug = `${f.slug}-${lineSlug}`;
      await db
        .insert(s.products)
        .values({ slug, fragranceId: frag.id, lineId: lineIds.get(lineSlug)!, featured: FEATURED.has(slug) })
        .onConflictDoNothing({ target: s.products.slug });
      const [prod] = await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.slug, slug));

      await db
        .insert(s.productVariants)
        .values({ productId: prod.id, sku: `${line.skuPrefix}-${f.slug.toUpperCase()}`, size: line.volumeMl, unit: line.unit })
        .onConflictDoNothing({ target: s.productVariants.sku });
    }
  }

  const after = await count();
  console.log(`Catálogo: ${after} produtos no banco (${after - before} novos). Nada existente foi alterado.`);
}

async function count() {
  const r = await db.execute<{ n: number }>(sql`select count(*)::int as n from products`);
  return r.rows[0].n;
}

main().catch((e) => {
  console.error("Falha no seed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
