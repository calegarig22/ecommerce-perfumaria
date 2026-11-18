"use server";

import { randomBytes } from "node:crypto";
import { and, eq, inArray, max } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { del, put } from "@vercel/blob";
import { db, schema as s } from "../db";
import { env } from "../env";
import { requireUser } from "../session";
import { diff, recordAudit } from "../audit";
import { revalidateSite } from "../revalidate-site";
import { centsToInput, formatPrice, parsePrice, slugify } from "../format";
import { formatSize, isUnit } from "@perfumaria/db/units";

export type ActionState = { ok: boolean; message: string } | null;

/** Mensagem final: confirma o que foi salvo e se o site já mostra a mudança. */
async function done(what: string): Promise<ActionState> {
  refresh();
  const live = await revalidateSite();
  return {
    ok: true,
    message: live ? `${what} O site já mostra a mudança.` : `${what} O site atualiza em até 1 hora (não consegui avisá-lo agora).`,
  };
}

const fail = (message: string): ActionState => ({ ok: false, message });

const notesList = z
  .string()
  .max(500)
  .transform((v) =>
    v
      .split(/[,;\n]/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 20),
  );

const fragranceSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(60),
  family: z.string().trim().max(80),
  /** "" = não se aplica (casa, acessórios). */
  gender: z
    .enum(["feminino", "masculino", "unissex", ""])
    .transform((v) => (v === "" ? null : v)),
  notesTop: notesList,
  notesHeart: notesList,
  notesBase: notesList,
  description: z
    .string()
    .trim()
    .max(1200)
    .transform((v) => v || null),
  internalReference: z
    .string()
    .trim()
    .max(120)
    .transform((v) => v || null),
});

function readFragrance(fd: FormData) {
  return fragranceSchema.safeParse({
    name: fd.get("name") ?? "",
    family: fd.get("family") ?? "",
    gender: fd.get("gender") ?? "",
    notesTop: fd.get("notesTop") ?? "",
    notesHeart: fd.get("notesHeart") ?? "",
    notesBase: fd.get("notesBase") ?? "",
    description: fd.get("description") ?? "",
    internalReference: fd.get("internalReference") ?? "",
  });
}

function parseStock(v: FormDataEntryValue | null): number | null | typeof NaN {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return /^\d{1,6}$/.test(s) ? Number(s) : NaN;
}

/** Tamanho: vazio = sem tamanho; senão inteiro de 1 a 99999. */
function parseSize(v: FormDataEntryValue | null): number | null | typeof NaN {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return /^\d{1,5}$/.test(s) && Number(s) > 0 ? Number(s) : NaN;
}

const readLabel = (v: FormDataEntryValue | null) => String(v ?? "").trim().slice(0, 40) || null;

/** Sufixo do SKU por tamanho: 220ML, 180G, 3UN, ou o rótulo ("REFIL"). */
function skuSuffix(size: number | null, unit: string, label: string | null) {
  const parts = [label ? slugify(label).toUpperCase() : "", size ? `${size}${unit.toUpperCase()}` : ""].filter(Boolean);
  return parts.join("-");
}

/* ───────────────────────────── Produto ───────────────────────────── */

export async function updateProductFlags(productId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const [before] = await db().select().from(s.products).where(eq(s.products.id, productId));
  if (!before) return fail("Produto não encontrado.");
  const after = { active: fd.get("active") === "on", featured: fd.get("featured") === "on" };
  const changes = diff(before, after, { active: "à venda", featured: "destaque" });
  if (!Object.keys(changes).length) return { ok: true, message: "Nada mudou." };
  await db().update(s.products).set(after).where(eq(s.products.id, productId));
  await recordAudit(user, { action: "atualizar", entity: "produto", entityId: productId, summary: `Produto ${before.slug}`, changes });
  return done("Produto salvo.");
}

/* ──────────────────────────── Variações ──────────────────────────── */

export async function saveVariants(productId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const [product] = await db()
    .select({ slug: s.products.slug, fragSlug: s.fragrances.slug, prefix: s.productLines.skuPrefix, unit: s.productLines.unit })
    .from(s.products)
    .innerJoin(s.fragrances, eq(s.products.fragranceId, s.fragrances.id))
    .innerJoin(s.productLines, eq(s.products.lineId, s.productLines.id))
    .where(eq(s.products.id, productId));
  if (!product) return fail("Produto não encontrado.");

  const current = await db().select().from(s.productVariants).where(eq(s.productVariants.productId, productId));
  const updates: {
    id: number;
    sku: string;
    set: { priceCents: number | null; stock: number | null; active: boolean; size: number | null; unit: string; label: string | null };
  }[] = [];
  const changes: Record<string, { de: unknown; para: unknown }> = {};

  for (const v of current) {
    const price = parsePrice(String(fd.get(`v${v.id}-price`) ?? ""));
    const stock = parseStock(fd.get(`v${v.id}-stock`));
    const size = fd.has(`v${v.id}-size`) ? parseSize(fd.get(`v${v.id}-size`)) : v.size;
    if (Number.isNaN(price)) return fail(`Preço inválido em ${v.sku}. Use o formato 89,90.`);
    if (Number.isNaN(stock)) return fail(`Estoque inválido em ${v.sku}. Use um número inteiro ou deixe vazio.`);
    if (Number.isNaN(size)) return fail(`Tamanho inválido em ${v.sku}. Use um número inteiro (ex.: 220) ou deixe vazio.`);
    if (price != null && price > 1_000_000_00) return fail(`Preço alto demais em ${v.sku}.`);
    const label = fd.has(`v${v.id}-label`) ? readLabel(fd.get(`v${v.id}-label`)) : v.label;
    const unitIn = fd.get(`v${v.id}-unit`);
    const unit = isUnit(unitIn) ? unitIn : v.unit;
    const set = { priceCents: price, stock, active: fd.get(`v${v.id}-active`) === "on", size, unit, label };
    const d = diff(v, set, { priceCents: "preço", stock: "estoque", active: "ativa", size: "tamanho", unit: "unidade", label: "rótulo" });
    if (Object.keys(d).length) {
      updates.push({ id: v.id, sku: v.sku, set });
      for (const [k, val] of Object.entries(d)) {
        changes[`${v.sku} · ${k}`] = k === "preço" ? { de: formatPrice(val.de as number | null), para: formatPrice(val.para as number | null) } : val;
      }
    }
  }

  // Nova variação (outro tamanho, refil, kit...)
  const newSize = parseSize(fd.get("new-size"));
  const newLabel = readLabel(fd.get("new-label"));
  let insert: typeof s.productVariants.$inferInsert | null = null;
  if (newSize != null || newLabel) {
    if (Number.isNaN(newSize)) return fail("Tamanho da nova opção inválido. Use um número inteiro (ex.: 250).");
    const unitIn = String(fd.get("new-unit") ?? product.unit);
    const unit = isUnit(unitIn) ? unitIn : "ml";
    const price = parsePrice(String(fd.get("new-price") ?? ""));
    const stock = parseStock(fd.get("new-stock"));
    if (Number.isNaN(price)) return fail("Preço da nova opção inválido. Use o formato 89,90.");
    if (Number.isNaN(stock)) return fail("Estoque da nova opção inválido.");
    const sku = `${product.prefix}-${product.fragSlug.toUpperCase()}-${skuSuffix(newSize, unit, newLabel)}`;
    const what = formatSize(newSize, unit, newLabel);
    if (current.some((v) => v.sku === sku)) return fail(`Já existe a opção ${what}.`);
    insert = { productId, sku, size: newSize, unit, label: newLabel, priceCents: price, stock, active: true };
    changes[`${sku} · nova`] = { de: null, para: `${what} · ${formatPrice(price) ?? "sob consulta"}` };
  }

  if (!updates.length && !insert) return { ok: true, message: "Nada mudou." };

  await db().transaction(async (tx) => {
    for (const u of updates) await tx.update(s.productVariants).set(u.set).where(eq(s.productVariants.id, u.id));
    if (insert) await tx.insert(s.productVariants).values(insert);
  });
  await recordAudit(user, { action: "atualizar", entity: "variações", entityId: productId, summary: `Preço/estoque de ${product.slug}`, changes });
  return done("Preços e estoque salvos.");
}

/* ──────────────────────────── Fragrância ──────────────────────────── */

export async function updateFragrance(fragranceId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = readFragrance(fd);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const [before] = await db().select().from(s.fragrances).where(eq(s.fragrances.id, fragranceId));
  if (!before) return fail("Fragrância não encontrada.");
  const changes = diff(before, parsed.data, {
    name: "nome",
    family: "família",
    gender: "público",
    notesTop: "notas de saída",
    notesHeart: "notas de coração",
    notesBase: "notas de fundo",
    description: "descrição",
    internalReference: "referência interna",
  });
  if (!Object.keys(changes).length) return { ok: true, message: "Nada mudou." };
  await db().update(s.fragrances).set(parsed.data).where(eq(s.fragrances.id, fragranceId));
  await recordAudit(user, { action: "atualizar", entity: "fragrância", entityId: fragranceId, summary: `Fragrância ${before.name}`, changes });
  return done("Dados do produto salvos.");
}

export async function createFragrance(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = readFragrance(fd);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const slug = slugify(parsed.data.name);
  if (!slug) return fail("Nome inválido.");

  const lines = await db().select().from(s.productLines);
  const chosen: { line: (typeof lines)[number]; size: number | null; price: number | null; stock: number | null }[] = [];
  for (const line of lines) {
    if (fd.get(`line-${line.id}`) !== "on") continue;
    const size = parseSize(fd.get(`line-${line.id}-size`));
    const price = parsePrice(String(fd.get(`line-${line.id}-price`) ?? ""));
    const stock = parseStock(fd.get(`line-${line.id}-stock`));
    if (Number.isNaN(size)) return fail(`Tamanho inválido em ${line.name}. Use um número inteiro (ex.: 220).`);
    if (Number.isNaN(price)) return fail(`Preço inválido em ${line.name}. Use o formato 89,90.`);
    if (Number.isNaN(stock)) return fail(`Estoque inválido em ${line.name}.`);
    chosen.push({ line, size, price, stock });
  }
  if (!chosen.length) return fail("Escolha pelo menos uma categoria (perfume, vela, aromatizador...).");

  const [exists] = await db().select({ id: s.fragrances.id }).from(s.fragrances).where(eq(s.fragrances.slug, slug));
  if (exists) return fail(`Já existe um produto chamado "${parsed.data.name}". Abra-o e adicione a nova categoria por lá, ou use outro nome.`);

  const active = fd.get("active") === "on";
  const firstProductId = await db().transaction(async (tx) => {
    const [f] = await tx.insert(s.fragrances).values({ ...parsed.data, slug }).returning({ id: s.fragrances.id });
    let first = 0;
    for (const c of chosen) {
      const [p] = await tx
        .insert(s.products)
        .values({ slug: `${slug}-${c.line.slug}`, fragranceId: f.id, lineId: c.line.id, active })
        .returning({ id: s.products.id });
      first ||= p.id;
      await tx.insert(s.productVariants).values({
        productId: p.id,
        sku: `${c.line.skuPrefix}-${slug.toUpperCase()}`,
        size: c.size,
        unit: c.line.unit,
        priceCents: c.price,
        stock: c.stock,
      });
    }
    return first;
  });

  // Fotos enviadas no cadastro (já reduzidas no navegador) vão para o primeiro produto criado.
  const photos = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 8);
  let photoErrors = 0;
  for (const file of photos) {
    const err = await saveProductImage(firstProductId, `${slug}-${chosen[0].line.slug}`, file, `${chosen[0].line.shortName} ${parsed.data.name}`);
    if (err) photoErrors++;
  }

  await recordAudit(user, {
    action: "criar",
    entity: "produto",
    entityId: slug,
    summary: `Novo produto ${parsed.data.name} (${chosen.map((c) => c.line.shortName).join(", ")})${active ? "" : " — oculta"}`,
  });
  await revalidateSite();
  redirect(`/produtos/${firstProductId}?criado=1${photoErrors ? `&fotos=${photoErrors}` : ""}`);
}

/* ────────────────────────────── Fotos ────────────────────────────── */

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Confere o tipo pelo conteúdo do arquivo (não pela extensão enviada pelo navegador). */
function sniffImage(buf: Uint8Array): { ext: string; type: string } | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: "png", type: "image/png" };
  if (String.fromCharCode(...buf.slice(0, 4)) === "RIFF" && String.fromCharCode(...buf.slice(8, 12)) === "WEBP")
    return { ext: "webp", type: "image/webp" };
  return null;
}

/** Grava uma foto do produto (Blob em produção; pasta local em desenvolvimento). Devolve erro em texto ou null. */
async function saveProductImage(productId: number, slug: string, file: File, alt: string): Promise<string | null> {
  const devLocal = !env().BLOB_READ_WRITE_TOKEN && process.env.NODE_ENV === "development";
  if (!env().BLOB_READ_WRITE_TOKEN && !devLocal) return "Armazenamento de fotos ainda não configurado (Vercel Blob).";
  if (file.size === 0) return "Foto vazia.";
  if (file.size > MAX_IMAGE_BYTES) return "Foto maior que 4 MB. Reduza o tamanho e tente de novo.";
  const buf = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) return "Formato não aceito. Use JPG, PNG ou WebP.";
  const key = `produtos/${slug}/${randomBytes(8).toString("hex")}.${kind.ext}`;
  // Em desenvolvimento sem Blob, grava em public/_dev-uploads (fora do git) só para testar o painel.
  const blob = devLocal
    ? await saveDevUpload(key, buf)
    : await put(key, Buffer.from(buf), { access: "public", contentType: kind.type, addRandomSuffix: false });
  const [{ m }] = await db().select({ m: max(s.productImages.sort) }).from(s.productImages).where(eq(s.productImages.productId, productId));
  await db().insert(s.productImages).values({ productId, url: blob.url, alt: alt.slice(0, 140) || `Foto do produto ${slug}`, sort: (m ?? -1) + 1 });
  return null;
}

export async function uploadImage(productId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Escolha uma foto.");
  const [p] = await db().select({ slug: s.products.slug }).from(s.products).where(eq(s.products.id, productId));
  if (!p) return fail("Produto não encontrado.");
  const error = await saveProductImage(productId, p.slug, file, String(fd.get("alt") ?? "").trim());
  if (error) return fail(error);
  await recordAudit(user, { action: "criar", entity: "foto", entityId: productId, summary: `Foto adicionada em ${p.slug}` });
  return done("Foto adicionada.");
}

async function saveDevUpload(key: string, buf: Uint8Array) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const file = path.join(process.cwd(), "public", "_dev-uploads", key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf);
  return { url: `/_dev-uploads/${key}` };
}

export async function deleteImage(productId: number, imageId: number): Promise<void> {
  const user = await requireUser();
  const [img] = await db()
    .select()
    .from(s.productImages)
    .where(and(eq(s.productImages.id, imageId), eq(s.productImages.productId, productId)));
  if (!img) return;
  await db().delete(s.productImages).where(eq(s.productImages.id, imageId));
  if (env().BLOB_READ_WRITE_TOKEN && img.url.includes(".blob.vercel-storage.com")) {
    await del(img.url).catch((e) => console.error("blob del", (e as Error).message));
  }
  await recordAudit(user, { action: "excluir", entity: "foto", entityId: productId, summary: `Foto removida (${img.alt})` });
  refresh();
  await revalidateSite();
}

export async function makeCover(productId: number, imageId: number): Promise<void> {
  const user = await requireUser();
  const imgs = await db().select().from(s.productImages).where(eq(s.productImages.productId, productId));
  if (!imgs.some((i) => i.id === imageId)) return;
  const ordered = [imageId, ...imgs.filter((i) => i.id !== imageId).sort((a, b) => a.sort - b.sort).map((i) => i.id)];
  await db().transaction(async (tx) => {
    for (const [i, id] of ordered.entries()) await tx.update(s.productImages).set({ sort: i }).where(eq(s.productImages.id, id));
  });
  await recordAudit(user, { action: "atualizar", entity: "foto", entityId: productId, summary: "Foto principal alterada" });
  refresh();
  await revalidateSite();
}

/* Ajuste rápido de preço na listagem (vários de uma vez). */
export async function quickPrices(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const ids = [...fd.keys()].filter((k) => /^p\d+$/.test(k)).map((k) => Number(k.slice(1)));
  if (!ids.length) return { ok: true, message: "Nada mudou." };
  const current = await db().select().from(s.productVariants).where(inArray(s.productVariants.id, ids));
  const changes: Record<string, { de: unknown; para: unknown }> = {};
  const updates: { id: number; priceCents: number | null }[] = [];
  for (const v of current) {
    const price = parsePrice(String(fd.get(`p${v.id}`) ?? ""));
    if (Number.isNaN(price)) return fail(`Preço inválido em ${v.sku}. Use o formato 89,90.`);
    if (centsToInput(price) !== centsToInput(v.priceCents)) {
      updates.push({ id: v.id, priceCents: price });
      changes[v.sku] = { de: formatPrice(v.priceCents), para: formatPrice(price) };
    }
  }
  if (!updates.length) return { ok: true, message: "Nada mudou." };
  await db().transaction(async (tx) => {
    for (const u of updates) await tx.update(s.productVariants).set({ priceCents: u.priceCents }).where(eq(s.productVariants.id, u.id));
  });
  await recordAudit(user, { action: "atualizar", entity: "variações", summary: `Preços atualizados (${updates.length})`, changes });
  return done(`${updates.length} preço(s) salvo(s).`);
}

/* ─────────────────────────── Excluir produto ─────────────────────────── */

/**
 * Exclui o produto (fragrância nesta linha) com variações e fotos.
 * Pedidos antigos não são afetados: os itens guardam nome, SKU e preço da época.
 * Se era a última linha da fragrância, a fragrância também é excluída.
 */
export async function deleteProduct(productId: number, fd: FormData): Promise<void> {
  const user = await requireUser();
  const [p] = await db()
    .select({ slug: s.products.slug, fragranceId: s.products.fragranceId, name: s.fragrances.name, line: s.productLines.name })
    .from(s.products)
    .innerJoin(s.fragrances, eq(s.products.fragranceId, s.fragrances.id))
    .innerJoin(s.productLines, eq(s.products.lineId, s.productLines.id))
    .where(eq(s.products.id, productId));
  if (!p) redirect("/produtos");
  // Confirmação digitada no formulário (evita exclusão por clique acidental).
  if (String(fd.get("confirm") ?? "").trim().toLowerCase() !== p.name.toLowerCase()) redirect(`/produtos/${productId}?erro=confirmacao`);

  const images = await db().select({ url: s.productImages.url }).from(s.productImages).where(eq(s.productImages.productId, productId));
  const fragranceGone = await db().transaction(async (tx) => {
    await tx.delete(s.products).where(eq(s.products.id, productId)); // variações e fotos saem em cascata
    const rest = await tx.select({ id: s.products.id }).from(s.products).where(eq(s.products.fragranceId, p.fragranceId)).limit(1);
    if (!rest.length) await tx.delete(s.fragrances).where(eq(s.fragrances.id, p.fragranceId));
    return !rest.length;
  });

  if (env().BLOB_READ_WRITE_TOKEN) {
    const urls = images.map((i) => i.url).filter((u) => u.includes(".blob.vercel-storage.com"));
    if (urls.length) await del(urls).catch((e) => console.error("blob del", (e as Error).message));
  }
  await recordAudit(user, {
    action: "excluir",
    entity: "produto",
    entityId: p.slug,
    summary: `Produto excluído: ${p.name} · ${p.line}${fragranceGone ? " (fragrância também removida)" : ""}`,
  });
  await revalidateSite();
  redirect("/produtos?excluido=1");
}

/* ─────────────────────────── Categorias ─────────────────────────── */

const categorySchema = z.object({
  name: z.string().trim().min(2, "Nome da categoria muito curto").max(40, "Nome da categoria muito longo (até 40)"),
  shortName: z
    .string()
    .trim()
    .max(24, "Nome curto muito longo (até 24)")
    .transform((v) => v || null),
  description: z.string().trim().max(300, "Descrição muito longa (até 300)"),
  unit: z.enum(["ml", "g", "un"], { message: "Escolha a unidade (ml, g ou unidades)." }),
  sort: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : 0))
    .pipe(z.number().int().min(0).max(999)),
});

function readCategory(fd: FormData) {
  return categorySchema.safeParse({
    name: fd.get("name") ?? "",
    shortName: fd.get("shortName") ?? "",
    description: fd.get("description") ?? "",
    unit: fd.get("unit") ?? "",
    sort: fd.get("sort") ?? "",
  });
}

/** Prefixo de SKU a partir do nome ("Velas aromáticas" → "VA"), único na tabela. */
function skuPrefixFor(slug: string, taken: Set<string>) {
  const words = slug.split("-").filter(Boolean);
  const base = (words.length > 1 ? words[0][0] + words[1][0] : slug.slice(0, 2)).toUpperCase() || "CT";
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
  return `${base}${randomBytes(2).toString("hex").toUpperCase()}`;
}

export async function createCategory(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = readCategory(fd);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const slug = slugify(parsed.data.name);
  if (!slug) return fail("Nome inválido.");
  const lines = await db().select({ slug: s.productLines.slug, prefix: s.productLines.skuPrefix, sort: s.productLines.sort }).from(s.productLines);
  if (lines.some((l) => l.slug === slug)) return fail(`Já existe a categoria "${parsed.data.name}".`);
  const skuPrefix = skuPrefixFor(slug, new Set(lines.map((l) => l.prefix)));
  const sort = parsed.data.sort || Math.max(0, ...lines.map((l) => l.sort)) + 1;
  await db()
    .insert(s.productLines)
    .values({
      slug,
      name: parsed.data.name,
      shortName: parsed.data.shortName ?? parsed.data.name,
      description: parsed.data.description,
      unit: parsed.data.unit,
      skuPrefix,
      sort,
    });
  await recordAudit(user, { action: "criar", entity: "categoria", entityId: slug, summary: `Nova categoria ${parsed.data.name} (${parsed.data.unit})` });
  return done(`Categoria ${parsed.data.name} criada. Ela aparece no site quando tiver um produto à venda.`);
}

export async function updateCategory(lineId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = readCategory(fd);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const [before] = await db().select().from(s.productLines).where(eq(s.productLines.id, lineId));
  if (!before) return fail("Categoria não encontrada.");
  // O slug (endereço no site) não muda ao renomear: links compartilhados continuam funcionando.
  const after = {
    name: parsed.data.name,
    shortName: parsed.data.shortName ?? parsed.data.name,
    description: parsed.data.description,
    unit: parsed.data.unit,
    sort: parsed.data.sort,
    active: fd.get("active") === "on",
  };
  const changes = diff(before, after, {
    name: "nome",
    shortName: "nome curto",
    description: "descrição",
    unit: "unidade",
    sort: "ordem",
    active: "visível no site",
  });
  if (!Object.keys(changes).length) return { ok: true, message: "Nada mudou." };
  await db().update(s.productLines).set(after).where(eq(s.productLines.id, lineId));
  await recordAudit(user, { action: "atualizar", entity: "categoria", entityId: lineId, summary: `Categoria ${before.name}`, changes });
  return done("Categoria salva.");
}

/** Só exclui categoria vazia: produtos precisam ser excluídos ou movidos antes. */
export async function deleteCategory(lineId: number): Promise<void> {
  const user = await requireUser();
  const [line] = await db().select().from(s.productLines).where(eq(s.productLines.id, lineId));
  if (!line) redirect("/categorias");
  const [used] = await db().select({ id: s.products.id }).from(s.products).where(eq(s.products.lineId, lineId)).limit(1);
  if (used) redirect("/categorias?erro=em-uso");
  await db().delete(s.productLines).where(eq(s.productLines.id, lineId));
  await recordAudit(user, { action: "excluir", entity: "categoria", entityId: line.slug, summary: `Categoria excluída: ${line.name}` });
  await revalidateSite();
  redirect("/categorias?excluida=1");
}

/** Vende um produto já cadastrado em outra categoria (ex.: Aurora também como vela). */
export async function addToCategory(fragranceId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const lineId = Number(fd.get("lineId"));
  if (!Number.isInteger(lineId)) return fail("Escolha a categoria.");
  const [[frag], [line]] = await Promise.all([
    db().select().from(s.fragrances).where(eq(s.fragrances.id, fragranceId)),
    db().select().from(s.productLines).where(eq(s.productLines.id, lineId)),
  ]);
  if (!frag || !line) return fail("Produto ou categoria não encontrados.");
  const size = parseSize(fd.get("size"));
  const price = parsePrice(String(fd.get("price") ?? ""));
  const stock = parseStock(fd.get("stock"));
  if (Number.isNaN(size)) return fail("Tamanho inválido. Use um número inteiro (ex.: 180).");
  if (Number.isNaN(price)) return fail("Preço inválido. Use o formato 89,90.");
  if (Number.isNaN(stock)) return fail("Estoque inválido.");

  const slug = `${frag.slug}-${line.slug}`;
  const [exists] = await db()
    .select({ id: s.products.id })
    .from(s.products)
    .where(and(eq(s.products.fragranceId, fragranceId), eq(s.products.lineId, lineId)));
  if (exists) return fail(`${frag.name} já está na categoria ${line.name}.`);

  const id = await db().transaction(async (tx) => {
    const [p] = await tx.insert(s.products).values({ slug, fragranceId, lineId, active: false }).returning({ id: s.products.id });
    await tx.insert(s.productVariants).values({
      productId: p.id,
      sku: `${line.skuPrefix}-${frag.slug.toUpperCase()}`,
      size,
      unit: line.unit,
      priceCents: price,
      stock,
    });
    return p.id;
  });
  await recordAudit(user, { action: "criar", entity: "produto", entityId: slug, summary: `${frag.name} adicionado em ${line.name} (oculto)` });
  redirect(`/produtos/${id}?criado=1`);
}

/* ─────────────────────── Estoque rápido e ações em lote ─────────────────────── */

/** Botões − / + da lista ("vendi 1", "chegou 1"). Devolve o estoque novo. */
export async function adjustStock(variantId: number, delta: 1 | -1): Promise<{ ok: boolean; stock: number | null; message?: string }> {
  const user = await requireUser();
  if (delta !== 1 && delta !== -1) return { ok: false, stock: null, message: "Ajuste inválido." };
  const [v] = await db().select().from(s.productVariants).where(eq(s.productVariants.id, variantId));
  if (!v) return { ok: false, stock: null, message: "Produto não encontrado." };
  if (v.stock == null) return { ok: false, stock: null, message: "Este produto é sob encomenda (sem controle de estoque)." };
  const next = Math.max(0, v.stock + delta);
  if (next === v.stock) return { ok: true, stock: next };
  await db().update(s.productVariants).set({ stock: next }).where(eq(s.productVariants.id, variantId));
  await recordAudit(user, {
    action: "atualizar",
    entity: "estoque",
    entityId: v.sku,
    summary: `${delta < 0 ? "Saída" : "Entrada"} de 1 un. em ${v.sku}`,
    changes: { estoque: { de: v.stock, para: next } },
  });
  if (next === 0 || v.stock === 0) await revalidateSite(); // esgotou ou voltou: o site precisa saber
  refresh();
  return { ok: true, stock: next };
}

const BULK_OPS = ["publicar", "ocultar", "destacar", "tirar-destaque", "reajustar"] as const;

/** Ações em vários produtos marcados na lista. */
export async function bulkProducts(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const ids = fd
    .getAll("ids")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 500);
  const op = String(fd.get("op") ?? "") as (typeof BULK_OPS)[number];
  if (!ids.length) return fail("Marque pelo menos um produto na lista.");
  if (!BULK_OPS.includes(op)) return fail("Escolha o que fazer com os produtos marcados.");

  if (op === "reajustar") {
    const pct = Number(String(fd.get("pct") ?? "").replace(",", "."));
    if (!Number.isFinite(pct) || pct === 0 || pct < -90 || pct > 300) return fail("Informe o reajuste em % (ex.: 10 ou -5).");
    const vars = await db().select().from(s.productVariants).where(inArray(s.productVariants.productId, ids));
    const priced = vars.filter((v) => v.priceCents != null);
    if (!priced.length) return fail("Os produtos marcados não têm preço para reajustar.");
    const changes: Record<string, { de: unknown; para: unknown }> = {};
    await db().transaction(async (tx) => {
      for (const v of priced) {
        // Arredonda para o próximo ,90 (ex.: 87,34 → 87,90), padrão de preço da loja.
        const raw = (v.priceCents! * (100 + pct)) / 100;
        const rounded = Math.max(90, Math.floor(raw / 100) * 100 + 90);
        await tx.update(s.productVariants).set({ priceCents: rounded }).where(eq(s.productVariants.id, v.id));
        changes[v.sku] = { de: formatPrice(v.priceCents), para: formatPrice(rounded) };
      }
    });
    await recordAudit(user, { action: "atualizar", entity: "variações", summary: `Reajuste de ${pct}% em ${priced.length} preço(s)`, changes });
    return done(`${priced.length} preço(s) reajustado(s) em ${pct}% (arredondados para ,90).`);
  }

  const set =
    op === "publicar" ? { active: true } : op === "ocultar" ? { active: false } : op === "destacar" ? { featured: true } : { featured: false };
  await db().update(s.products).set(set).where(inArray(s.products.id, ids));
  const label = { publicar: "publicado(s)", ocultar: "ocultado(s)", destacar: "em destaque", "tirar-destaque": "sem destaque" }[op];
  await recordAudit(user, { action: "atualizar", entity: "produto", summary: `${ids.length} produto(s) ${label}`, changes: { produtos: { de: null, para: ids.join(", ") } } });
  return done(`${ids.length} produto(s) ${label}.`);
}

/** Copia um produto com outro nome (ex.: nova vela parecida). Entra oculto, sem estoque e sem fotos. */
export async function duplicateProduct(productId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  if (name.length < 2) return fail("Dê um nome para o novo produto.");
  const slug = slugify(name);
  const [src] = await db()
    .select({ product: s.products, fragrance: s.fragrances, line: s.productLines })
    .from(s.products)
    .innerJoin(s.fragrances, eq(s.products.fragranceId, s.fragrances.id))
    .innerJoin(s.productLines, eq(s.products.lineId, s.productLines.id))
    .where(eq(s.products.id, productId));
  if (!src) return fail("Produto não encontrado.");
  const [exists] = await db().select({ id: s.fragrances.id }).from(s.fragrances).where(eq(s.fragrances.slug, slug));
  if (exists) return fail(`Já existe um produto chamado "${name}".`);
  const variants = await db().select().from(s.productVariants).where(eq(s.productVariants.productId, productId));

  const f0 = src.fragrance;
  const frag = {
    family: f0.family,
    gender: f0.gender,
    notesTop: f0.notesTop,
    notesHeart: f0.notesHeart,
    notesBase: f0.notesBase,
    description: f0.description,
    active: f0.active,
  };
  const newId = await db().transaction(async (tx) => {
    const [f] = await tx.insert(s.fragrances).values({ ...frag, name, slug, internalReference: null }).returning({ id: s.fragrances.id });
    const [p] = await tx
      .insert(s.products)
      .values({ slug: `${slug}-${src.line.slug}`, fragranceId: f.id, lineId: src.line.id, active: false })
      .returning({ id: s.products.id });
    for (const v of variants) {
      await tx.insert(s.productVariants).values({
        productId: p.id,
        sku: `${src.line.skuPrefix}-${slug.toUpperCase()}${v.sku.slice(`${src.line.skuPrefix}-${src.fragrance.slug.toUpperCase()}`.length)}`,
        size: v.size,
        unit: v.unit,
        label: v.label,
        priceCents: v.priceCents,
        stock: v.stock == null ? null : 0,
      });
    }
    return p.id;
  });
  await recordAudit(user, { action: "criar", entity: "produto", entityId: slug, summary: `${name} criado a partir de ${src.fragrance.name} (oculto)` });
  redirect(`/produtos/${newId}?criado=1`);
}

/** Nova ordem das categorias nos menus do site (lista completa de ids, na ordem desejada). */
export async function reorderCategories(ids: number[]): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const lines = await db().select({ id: s.productLines.id, name: s.productLines.name }).from(s.productLines);
  const valid = Array.isArray(ids) && ids.length === lines.length && new Set(ids).size === ids.length && ids.every((id) => lines.some((l) => l.id === id));
  if (!valid) return { ok: false, message: "A lista mudou enquanto você arrastava. Recarregue a página." };
  await db().transaction(async (tx) => {
    for (const [n, id] of ids.entries()) await tx.update(s.productLines).set({ sort: n + 1 }).where(eq(s.productLines.id, id));
  });
  const names = ids.map((id) => lines.find((l) => l.id === id)!.name);
  await recordAudit(user, { action: "atualizar", entity: "categoria", summary: `Nova ordem: ${names.join(" › ")}` });
  refresh();
  await revalidateSite();
  return { ok: true, message: "Ordem salva." };
}
