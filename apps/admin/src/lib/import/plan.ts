import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, schema as s } from "../db";
import { formatPrice, slugify } from "../format";
import { formatSize } from "@perfumaria/db/units";
import { norm, type ImportRow } from "./rows";

export type PlanKind = "atualizar" | "novo-tamanho" | "novo-produto" | "igual" | "erro";
export type PlanItem = {
  row: number;
  kind: PlanKind;
  title: string;
  category: string;
  changes: string[];
  warn?: string;
  newCategory?: boolean;
};
export type Plan = { items: PlanItem[]; counts: Record<PlanKind, number>; newCategories: string[] };

type Snapshot = Awaited<ReturnType<typeof loadSnapshot>>;

async function loadSnapshot() {
  const [lines, frags, products, variants] = await Promise.all([
    db().select().from(s.productLines),
    db().select().from(s.fragrances),
    db().select().from(s.products),
    db().select().from(s.productVariants),
  ]);
  return { lines, frags, products, variants };
}

const PERFUMARIA = new Set(["perfume", "body-splash", "perfume-cabelo"]);

function findLine(snap: Snapshot, category: string | undefined) {
  if (!category) return null;
  const n = norm(category);
  const singular = n.replace(/s\b/g, "");
  return (
    snap.lines.find((l) => [l.name, l.shortName, l.slug].some((x) => norm(x) === n)) ??
    snap.lines.find((l) => [l.name, l.shortName, l.slug].some((x) => norm(x).replace(/s\b/g, "") === singular)) ??
    null
  );
}

function findFragrance(snap: Snapshot, name: string) {
  const slug = slugify(name);
  const n = norm(name);
  return snap.frags.find((f) => f.slug === slug || norm(f.name) === n) ?? null;
}

type Resolved =
  | { kind: "erro"; msg: string }
  | {
      kind: "match";
      variant: Snapshot["variants"][number];
      product: Snapshot["products"][number];
      frag: Snapshot["frags"][number];
      line: Snapshot["lines"][number];
    }
  | {
      kind: "new-variant";
      product: Snapshot["products"][number];
      frag: Snapshot["frags"][number];
      line: Snapshot["lines"][number];
    }
  | { kind: "new-product"; frag: Snapshot["frags"][number] | null; line: Snapshot["lines"][number] | null; categoryName: string };

function resolve(snap: Snapshot, r: ImportRow): Resolved {
  if (r.sku) {
    const v = snap.variants.find((x) => x.sku.toLowerCase() === r.sku!.toLowerCase());
    if (v) {
      const product = snap.products.find((p) => p.id === v.productId)!;
      return {
        kind: "match",
        variant: v,
        product,
        frag: snap.frags.find((f) => f.id === product.fragranceId)!,
        line: snap.lines.find((l) => l.id === product.lineId)!,
      };
    }
    if (!r.name) return { kind: "erro", msg: `Código ${r.sku} não existe e a linha não tem nome de produto.` };
  }
  if (!r.name || r.name.length < 2) return { kind: "erro", msg: "Falta o nome do produto." };

  const frag = findFragrance(snap, r.name);
  const line = findLine(snap, r.category);
  if (!line) {
    if (!r.category) {
      // Sem categoria: aceita se o produto existe em uma única categoria.
      const only = frag ? snap.products.filter((p) => p.fragranceId === frag.id) : [];
      if (only.length === 1) return resolve(snap, { ...r, category: snap.lines.find((l) => l.id === only[0].lineId)!.name });
      return { kind: "erro", msg: frag ? `"${r.name}" está em mais de uma categoria: informe qual.` : "Informe a categoria (ex.: Perfume, Velas aromáticas)." };
    }
    return { kind: "new-product", frag, line: null, categoryName: r.category };
  }
  const product = frag ? snap.products.find((p) => p.fragranceId === frag.id && p.lineId === line.id) : undefined;
  if (!product || !frag) return { kind: "new-product", frag, line, categoryName: line.name };

  const vars = snap.variants.filter((v) => v.productId === product.id);
  const wantLabel = norm(r.label ?? "");
  const exact = vars.find(
    (v) => (r.size === undefined || (v.size ?? null) === (r.size ?? null)) && (r.label === undefined || norm(v.label ?? "") === wantLabel),
  );
  if (exact) return { kind: "match", variant: exact, product, frag, line };
  // Sem tamanho na planilha e um único tamanho cadastrado: é ele.
  if (r.size === undefined && r.label === undefined && vars.length === 1) return { kind: "match", variant: vars[0], product, frag, line };
  if (r.size == null && !r.label) return { kind: "erro", msg: `"${r.name}" tem ${vars.length} tamanhos: informe qual (coluna Tamanho).` };
  return { kind: "new-variant", product, frag, line };
}

const price = (c: number | null | undefined) => formatPrice(c ?? null) ?? "sob consulta";
const stockTxt = (n: number | null | undefined) => (n == null ? "sob encomenda" : `${n} un.`);

function variantChanges(v: { priceCents: number | null; stock: number | null; active: boolean }, r: ImportRow) {
  const out: string[] = [];
  if (r.priceCents !== undefined && r.priceCents !== v.priceCents) out.push(`preço ${price(v.priceCents)} → ${price(r.priceCents)}`);
  if (r.stock !== undefined && r.stock !== v.stock) out.push(`estoque ${stockTxt(v.stock)} → ${stockTxt(r.stock)}`);
  return out;
}

function fragChanges(f: Snapshot["frags"][number], r: ImportRow) {
  const out: string[] = [];
  if (r.family && r.family !== f.family) out.push(`família → ${r.family}`);
  if (r.gender !== undefined && r.gender !== f.gender) out.push(`público → ${r.gender ?? "não se aplica"}`);
  if (r.description && r.description !== (f.description ?? "")) out.push("descrição atualizada");
  const notes = (a: string[] | undefined, b: string[]) => a && a.join(",") !== b.join(",");
  if (notes(r.notesTop, f.notesTop) || notes(r.notesHeart, f.notesHeart) || notes(r.notesBase, f.notesBase)) out.push("notas olfativas atualizadas");
  if (r.internalReference && r.internalReference !== (f.internalReference ?? "")) out.push("referência interna atualizada");
  return out;
}

export async function buildPlan(rows: ImportRow[]): Promise<Plan> {
  const snap = await loadSnapshot();
  const items: PlanItem[] = [];
  const newCats = new Set<string>();
  for (const [i, r] of rows.entries()) {
    const res = resolve(snap, r);
    const sizeTxt = formatSize(r.size ?? null, r.unit ?? null, r.label);
    if (res.kind === "erro") {
      items.push({ row: i + 1, kind: "erro", title: r.name || r.sku || "(sem nome)", category: r.category ?? "", changes: [], warn: res.msg });
    } else if (res.kind === "match") {
      const changes = [...variantChanges(res.variant, r), ...fragChanges(res.frag, r)];
      if (r.active !== undefined && r.active !== res.product.active) changes.push(r.active ? "colocar à venda" : "esconder do site");
      if (r.size !== undefined && r.size !== res.variant.size) changes.push(`tamanho → ${formatSize(r.size, r.unit ?? res.variant.unit, null) || "sem tamanho"}`);
      items.push({
        row: i + 1,
        kind: changes.length ? "atualizar" : "igual",
        title: `${res.frag.name}${formatSize(res.variant.size, res.variant.unit, res.variant.label) ? ` · ${formatSize(res.variant.size, res.variant.unit, res.variant.label)}` : ""}`,
        category: res.line.name,
        changes,
      });
    } else if (res.kind === "new-variant") {
      items.push({
        row: i + 1,
        kind: "novo-tamanho",
        title: `${res.frag.name} · ${sizeTxt || "nova opção"}`,
        category: res.line.name,
        changes: [`preço ${price(r.priceCents)}`, `estoque ${stockTxt(r.stock)}`],
      });
    } else {
      if (!res.line) newCats.add(res.categoryName);
      const isPerf = res.line ? PERFUMARIA.has(res.line.slug) : false;
      items.push({
        row: i + 1,
        kind: "novo-produto",
        title: `${r.name}${sizeTxt ? ` · ${sizeTxt}` : ""}`,
        category: res.categoryName,
        newCategory: !res.line,
        changes: [`preço ${price(r.priceCents)}`, `estoque ${stockTxt(r.stock)}`, ...(res.frag ? ["mesmo item já cadastrado em outra categoria"] : [])],
        warn: isPerf && !res.frag && r.gender == null ? "sem público (feminino/masculino): ajuste depois no produto" : undefined,
      });
    }
  }
  const counts = { atualizar: 0, "novo-tamanho": 0, "novo-produto": 0, igual: 0, erro: 0 } as Record<PlanKind, number>;
  for (const it of items) counts[it.kind]++;
  return { items, counts, newCategories: [...newCats] };
}

/** Aplica tudo numa transação. Linhas com erro são puladas. Devolve resumo e ids criados. */
export async function applyPlan(rows: ImportRow[], opts: { publishNew: boolean }) {
  return db().transaction(async (tx) => {
    const snap = await loadSnapshot();
    let updated = 0;
    let created = 0;
    let skipped = 0;
    const createdIds: number[] = [];
    const touchedFragIds = new Set<number>();

    const ensureLine = async (name: string, unit: "ml" | "g" | "un") => {
      const found = findLine(snap, name);
      if (found) return found;
      const slug = slugify(name);
      const taken = new Set(snap.lines.map((l) => l.skuPrefix));
      const words = slug.split("-").filter(Boolean);
      let prefix = (words.length > 1 ? words[0][0] + words[1][0] : slug.slice(0, 2)).toUpperCase() || "CT";
      for (let n = 2; taken.has(prefix); n++) prefix = `${prefix.replace(/\d+$/, "")}${n}`;
      const sort = Math.max(0, ...snap.lines.map((l) => l.sort)) + 1;
      const [l] = await tx
        .insert(s.productLines)
        .values({ slug, name: name.slice(0, 40), shortName: name.slice(0, 24), description: "", unit, skuPrefix: prefix, sort })
        .returning();
      snap.lines.push(l);
      return l;
    };

    for (const r of rows) {
      const res = resolve(snap, r);
      if (res.kind === "erro") {
        skipped++;
        continue;
      }
      if (res.kind === "match") {
        const set: Partial<typeof s.productVariants.$inferInsert> = {};
        if (r.priceCents !== undefined) set.priceCents = r.priceCents;
        if (r.stock !== undefined) set.stock = r.stock;
        if (r.size !== undefined) set.size = r.size;
        if (r.unit !== undefined) set.unit = r.unit;
        if (r.label !== undefined) set.label = r.label;
        const changed = Object.entries(set).some(([k, v]) => (res.variant as Record<string, unknown>)[k] !== v);
        if (changed) {
          await tx.update(s.productVariants).set(set).where(eq(s.productVariants.id, res.variant.id));
          Object.assign(res.variant, set);
        }
        let flagChanged = false;
        if (r.active !== undefined && r.active !== res.product.active) {
          await tx.update(s.products).set({ active: r.active }).where(eq(s.products.id, res.product.id));
          res.product.active = r.active;
          flagChanged = true;
        }
        const fragDiff = fragChanges(res.frag, r).length > 0;
        if (fragDiff) touchedFragIds.add(res.frag.id);
        if (changed || flagChanged || fragDiff) updated++;
        if (fragDiff) await updateFrag(tx, res.frag, r);
        continue;
      }
      if (res.kind === "new-variant") {
        const unit = r.unit ?? (res.line.unit as "ml" | "g" | "un");
        const sku = uniqueSku(snap, `${res.line.skuPrefix}-${res.frag.slug.toUpperCase()}-${[r.label ? slugify(r.label).toUpperCase() : "", r.size ? `${r.size}${unit.toUpperCase()}` : ""].filter(Boolean).join("-")}`);
        const [v] = await tx
          .insert(s.productVariants)
          .values({ productId: res.product.id, sku, size: r.size ?? null, unit, label: r.label ?? null, priceCents: r.priceCents ?? null, stock: r.stock ?? null })
          .returning();
        snap.variants.push(v);
        created++;
        continue;
      }
      // Produto novo (e talvez item e categoria novos)
      const line = res.line ?? (await ensureLine(res.categoryName, r.unit ?? "ml"));
      let frag = res.frag;
      if (!frag) {
        const slug = slugify(r.name);
        const [f] = await tx
          .insert(s.fragrances)
          .values({
            slug,
            name: r.name,
            family: r.family ?? "",
            gender: r.gender ?? null,
            notesTop: r.notesTop ?? [],
            notesHeart: r.notesHeart ?? [],
            notesBase: r.notesBase ?? [],
            description: r.description || null,
            internalReference: r.internalReference || null,
          })
          .returning();
        snap.frags.push(f);
        frag = f;
      }
      const [p] = await tx
        .insert(s.products)
        .values({ slug: `${frag.slug}-${line.slug}`, fragranceId: frag.id, lineId: line.id, active: r.active ?? opts.publishNew })
        .onConflictDoNothing({ target: s.products.slug })
        .returning();
      if (!p) {
        skipped++;
        continue;
      }
      snap.products.push(p);
      const unit = r.unit ?? (line.unit as "ml" | "g" | "un");
      const [v] = await tx
        .insert(s.productVariants)
        .values({
          productId: p.id,
          sku: uniqueSku(snap, `${line.skuPrefix}-${frag.slug.toUpperCase()}`),
          size: r.size ?? null,
          unit,
          label: r.label ?? null,
          priceCents: r.priceCents ?? null,
          stock: r.stock ?? null,
        })
        .returning();
      snap.variants.push(v);
      createdIds.push(p.id);
      created++;
    }
    return { updated, created, skipped, createdIds };
  });
}

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

async function updateFrag(tx: Tx, f: Snapshot["frags"][number], r: ImportRow) {
  const set: Partial<typeof s.fragrances.$inferInsert> = {};
  if (r.family) set.family = r.family;
  if (r.gender !== undefined) set.gender = r.gender;
  if (r.description) set.description = r.description;
  if (r.notesTop) set.notesTop = r.notesTop;
  if (r.notesHeart) set.notesHeart = r.notesHeart;
  if (r.notesBase) set.notesBase = r.notesBase;
  if (r.internalReference) set.internalReference = r.internalReference;
  if (!Object.keys(set).length) return;
  await tx.update(s.fragrances).set(set).where(eq(s.fragrances.id, f.id));
  Object.assign(f, set);
}

function uniqueSku(snap: Snapshot, base: string) {
  const clean = base.replace(/-+$/, "");
  const taken = new Set(snap.variants.map((v) => v.sku));
  if (!taken.has(clean)) return clean;
  for (let i = 2; ; i++) if (!taken.has(`${clean}-${i}`)) return `${clean}-${i}`;
}

/** Linhas da exportação: uma por tamanho, na ordem da loja. */
export async function exportRows() {
  const snap = await loadSnapshot();
  const lineById = new Map(snap.lines.map((l) => [l.id, l]));
  const fragById = new Map(snap.frags.map((f) => [f.id, f]));
  const out: unknown[][] = [];
  const products = [...snap.products].sort(
    (a, b) =>
      (lineById.get(a.lineId)!.sort - lineById.get(b.lineId)!.sort) ||
      fragById.get(a.fragranceId)!.name.localeCompare(fragById.get(b.fragranceId)!.name, "pt-BR"),
  );
  const ids = products.map((p) => p.id);
  const vars = ids.length ? await db().select().from(s.productVariants).where(inArray(s.productVariants.productId, ids)) : [];
  for (const p of products) {
    const f = fragById.get(p.fragranceId)!;
    const l = lineById.get(p.lineId)!;
    for (const v of vars.filter((x) => x.productId === p.id).sort((a, b) => (a.size ?? 0) - (b.size ?? 0))) {
      out.push([
        v.sku,
        f.name,
        l.name,
        v.size ?? "",
        v.unit,
        v.label ?? "",
        v.priceCents == null ? "consulta" : (v.priceCents / 100).toFixed(2).replace(".", ","),
        v.stock == null ? "encomenda" : v.stock,
        p.active ? "sim" : "não",
        f.family,
        f.gender ?? "",
        f.notesTop.join(", "),
        f.notesHeart.join(", "),
        f.notesBase.join(", "),
        f.description ?? "",
      ]);
    }
  }
  return out;
}
