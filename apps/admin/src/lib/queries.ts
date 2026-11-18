import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db, schema as s } from "./db";
import { linePhoto } from "@perfumaria/db/line-photos";

export const LOW_STOCK = 3;

export type ProductFilter = { q?: string; linha?: string; status?: string };

export async function listLines() {
  return db().select().from(s.productLines).orderBy(asc(s.productLines.sort), asc(s.productLines.name));
}

/** Categorias com contagem de produtos (total e à venda). */
export async function listCategories() {
  const [lines, counts] = await Promise.all([
    listLines(),
    db()
      .select({
        lineId: s.products.lineId,
        total: count(),
        active: sql<number>`count(*) filter (where ${s.products.active})`,
      })
      .from(s.products)
      .groupBy(s.products.lineId),
  ]);
  const byLine = new Map(counts.map((c) => [c.lineId, { total: Number(c.total), active: Number(c.active) }]));
  return lines.map((l) => ({ ...l, products: byLine.get(l.id) ?? { total: 0, active: 0 } }));
}

export async function listProducts(f: ProductFilter) {
  const where = [];
  if (f.q) where.push(or(ilike(s.fragrances.name, `%${f.q}%`), ilike(s.fragrances.family, `%${f.q}%`)));
  if (f.linha) where.push(eq(s.productLines.slug, f.linha));
  if (f.status === "ativos") where.push(eq(s.products.active, true));
  if (f.status === "inativos") where.push(eq(s.products.active, false));
  if (f.status === "destaque") where.push(eq(s.products.featured, true));

  const rows = await db()
    .select({
      id: s.products.id,
      slug: s.products.slug,
      active: s.products.active,
      featured: s.products.featured,
      name: s.fragrances.name,
      family: s.fragrances.family,
      gender: s.fragrances.gender,
      lineName: s.productLines.name,
      lineSlug: s.productLines.slug,
      lineSort: s.productLines.sort,
    })
    .from(s.products)
    .innerJoin(s.fragrances, eq(s.products.fragranceId, s.fragrances.id))
    .innerJoin(s.productLines, eq(s.products.lineId, s.productLines.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(s.productLines.sort), asc(s.fragrances.name));

  const ids = rows.map((r) => r.id);
  const [variants, images] = ids.length
    ? await Promise.all([
        db().select().from(s.productVariants).where(inArray(s.productVariants.productId, ids)).orderBy(asc(s.productVariants.size), asc(s.productVariants.id)),
        db()
          .select({ productId: s.productImages.productId, url: s.productImages.url, sort: s.productImages.sort, id: s.productImages.id })
          .from(s.productImages)
          .where(inArray(s.productImages.productId, ids))
          .orderBy(asc(s.productImages.sort), asc(s.productImages.id)),
      ])
    : [[], []];

  const imgCount = new Map<number, number>();
  const cover = new Map<number, string>();
  for (const i of images) {
    imgCount.set(i.productId, (imgCount.get(i.productId) ?? 0) + 1);
    if (!cover.has(i.productId)) cover.set(i.productId, i.url);
  }
  let list = rows.map((r) => ({
    ...r,
    variants: variants.filter((v) => v.productId === r.id),
    images: imgCount.get(r.id) ?? 0,
    // Mesma foto que o site mostra: a própria ou, sem ela, o frasco padrão da linha.
    cover: cover.get(r.id) ?? linePhoto(r.lineSlug, r.gender, "/frascos/"),
    defaultPhoto: !cover.has(r.id) && !!linePhoto(r.lineSlug, r.gender, "/frascos/"),
  }));
  if (f.status === "sem-foto") list = list.filter((p) => !p.cover);
  if (f.status === "sem-preco") list = list.filter((p) => p.variants.some((v) => v.active && v.priceCents == null));
  if (f.status === "estoque-baixo")
    list = list.filter((p) => p.variants.some((v) => v.active && v.stock != null && v.stock <= LOW_STOCK));
  return list;
}

export async function getProduct(id: number) {
  const [row] = await db()
    .select({ product: s.products, fragrance: s.fragrances, line: s.productLines })
    .from(s.products)
    .innerJoin(s.fragrances, eq(s.products.fragranceId, s.fragrances.id))
    .innerJoin(s.productLines, eq(s.products.lineId, s.productLines.id))
    .where(eq(s.products.id, id));
  if (!row) return null;
  const [variants, images, siblings] = await Promise.all([
    db().select().from(s.productVariants).where(eq(s.productVariants.productId, id)).orderBy(asc(s.productVariants.size), asc(s.productVariants.id)),
    db().select().from(s.productImages).where(eq(s.productImages.productId, id)).orderBy(asc(s.productImages.sort), asc(s.productImages.id)),
    db()
      .select({ id: s.products.id, lineId: s.products.lineId, lineName: s.productLines.name, active: s.products.active })
      .from(s.products)
      .innerJoin(s.productLines, eq(s.products.lineId, s.productLines.id))
      .where(eq(s.products.fragranceId, row.fragrance.id))
      .orderBy(asc(s.productLines.sort)),
  ]);
  return { ...row, variants, images, siblings };
}

export async function dashboardStats() {
  const [[products], [noPrice], [lowStock], [ordersToHandle], recent, withoutOwnPhoto, [hidden]] = await Promise.all([
    db().select({ n: count() }).from(s.products).where(eq(s.products.active, true)),
    db()
      .select({ n: sql<number>`count(distinct ${s.productVariants.productId})` })
      .from(s.productVariants)
      .innerJoin(s.products, eq(s.productVariants.productId, s.products.id))
      .where(and(eq(s.products.active, true), eq(s.productVariants.active, true), isNull(s.productVariants.priceCents))),
    db()
      .select({ n: count() })
      .from(s.productVariants)
      .innerJoin(s.products, eq(s.productVariants.productId, s.products.id))
      .where(and(eq(s.products.active, true), eq(s.productVariants.active, true), lte(s.productVariants.stock, LOW_STOCK))),
    db().select({ n: count() }).from(s.orders).where(inArray(s.orders.status, ["paid", "preparing"])),
    db().select().from(s.auditLog).orderBy(desc(s.auditLog.createdAt)).limit(8),
    db()
      .select({ line: s.productLines.slug, gender: s.fragrances.gender })
      .from(s.products)
      .innerJoin(s.productLines, eq(s.products.lineId, s.productLines.id))
      .innerJoin(s.fragrances, eq(s.products.fragranceId, s.fragrances.id))
      .where(sql`not exists (select 1 from ${s.productImages} where ${s.productImages.productId} = ${s.products.id})`),
    db().select({ n: count() }).from(s.products).where(eq(s.products.active, false)),
  ]);
  return {
    products: Number(products.n),
    noPrice: Number(noPrice.n),
    lowStock: Number(lowStock.n),
    ordersToHandle: Number(ordersToHandle.n),
    // Sem foto no site: sem foto própria e sem frasco padrão (ex.: velas sem foto).
    noPhoto: withoutOwnPhoto.filter((p) => !linePhoto(p.line, p.gender, "/frascos/")).length,
    hidden: Number(hidden.n),
    recent,
  };
}

export async function listAudit(limit = 200) {
  return db().select().from(s.auditLog).orderBy(desc(s.auditLog.createdAt)).limit(limit);
}

export async function listOrders(status?: string) {
  const valid = status && (s.orderStatusEnum.enumValues as readonly string[]).includes(status);
  return db()
    .select()
    .from(s.orders)
    .where(valid ? eq(s.orders.status, status as (typeof s.orderStatusEnum.enumValues)[number]) : undefined)
    .orderBy(desc(s.orders.createdAt))
    .limit(200);
}

export async function getOrder(code: string) {
  const [order] = await db().select().from(s.orders).where(eq(s.orders.code, code));
  if (!order) return null;
  const items = await db().select().from(s.orderItems).where(eq(s.orderItems.orderId, order.id)).orderBy(asc(s.orderItems.id));
  return { order, items };
}

/** Lista enxuta para escolher produto (fotos em lote, importação): nome, categoria, fotos. */
export async function productOptions() {
  const rows = await db()
    .select({
      id: s.products.id,
      name: s.fragrances.name,
      line: s.productLines.name,
      lineShort: s.productLines.shortName,
      lineSlug: s.productLines.slug,
      gender: s.fragrances.gender,
      active: s.products.active,
    })
    .from(s.products)
    .innerJoin(s.fragrances, eq(s.products.fragranceId, s.fragrances.id))
    .innerJoin(s.productLines, eq(s.products.lineId, s.productLines.id))
    .orderBy(asc(s.fragrances.name), asc(s.productLines.sort));
  const counts = await db()
    .select({ productId: s.productImages.productId, n: count() })
    .from(s.productImages)
    .groupBy(s.productImages.productId);
  const n = new Map(counts.map((c) => [c.productId, Number(c.n)]));
  return rows.map((r) => ({ ...r, photos: n.get(r.id) ?? 0, hasDefault: !!linePhoto(r.lineSlug, r.gender, "/frascos/") }));
}
