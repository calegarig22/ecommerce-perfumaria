/**
 * Linhas de importação: o formato comum que a planilha (CSV) e a leitura por IA
 * produzem. Campo ausente (undefined) = "não mexer".
 */
import { z } from "zod";
import { parsePrice } from "../format";

export const MAX_ROWS = 500;

export const importRowSchema = z.object({
  sku: z.string().trim().max(60).optional(),
  name: z.string().trim().max(60),
  category: z.string().trim().max(40).optional(),
  size: z.number().int().positive().max(99999).nullable().optional(),
  unit: z.enum(["ml", "g", "un"]).optional(),
  label: z.string().trim().max(40).nullable().optional(),
  /** Centavos; null = "sob consulta". */
  priceCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  /** null = sob encomenda. */
  stock: z.number().int().min(0).max(999999).nullable().optional(),
  active: z.boolean().optional(),
  family: z.string().trim().max(80).optional(),
  gender: z.enum(["feminino", "masculino", "unissex"]).nullable().optional(),
  notesTop: z.array(z.string().trim().max(60)).max(20).optional(),
  notesHeart: z.array(z.string().trim().max(60)).max(20).optional(),
  notesBase: z.array(z.string().trim().max(60)).max(20).optional(),
  description: z.string().trim().max(1200).optional(),
  internalReference: z.string().trim().max(120).optional(),
});
export type ImportRow = z.infer<typeof importRowSchema>;

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/* ───────────────────────────── CSV ───────────────────────────── */

/** Lê CSV (separador ; , ou tab, aspas, BOM do Excel). Devolve linhas de células. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** Cabeçalhos aceitos (sem acento, minúsculo) → campo. */
const HEADERS: Record<string, keyof ImportRow> = {
  codigo: "sku", sku: "sku", "cod": "sku", ref: "sku",
  produto: "name", nome: "name", fragrancia: "name", item: "name",
  categoria: "category", linha: "category", tipo: "category",
  tamanho: "size", volume: "size", peso: "size", ml: "size", gramas: "size",
  unidade: "unit",
  rotulo: "label", opcao: "label", variacao: "label",
  preco: "priceCents", valor: "priceCents", "preco r": "priceCents", "preco de venda": "priceCents",
  estoque: "stock", quantidade: "stock", qtd: "stock", qtde: "stock",
  "a venda": "active", "à venda": "active", ativo: "active", publicado: "active", "no site": "active",
  familia: "family", "familia olfativa": "family",
  publico: "gender", genero: "gender", para: "gender",
  "notas de saida": "notesTop", saida: "notesTop", topo: "notesTop",
  "notas de coracao": "notesHeart", coracao: "notesHeart",
  "notas de fundo": "notesBase", fundo: "notesBase", base: "notesBase",
  descricao: "description",
  "referencia interna": "internalReference", referencia: "internalReference", inspiracao: "internalReference",
};

const YES = new Set(["sim", "s", "x", "1", "true", "yes", "ativo", "a venda", "publicado"]);
const NO = new Set(["nao", "n", "0", "false", "no", "oculto", "escondido", "inativo"]);

/** "220 ml" → { size: 220, unit: "ml" }; "180g" → 180 g; "3 un" → 3 un. */
export function parseSizeCell(v: string): { size: number | null; unit?: "ml" | "g" | "un" } | "invalid" {
  const t = norm(v);
  if (!t) return { size: null };
  const m = t.match(/^(\d{1,5})(?:[.,]\d+)?\s*(ml|g|gr|gramas|un|und|unid|unidades|kit)?$/);
  if (!m) return "invalid";
  const u = m[2];
  const unit = !u ? undefined : u === "ml" ? "ml" : u.startsWith("g") ? "g" : "un";
  return { size: Number(m[1]), unit };
}

export type CsvResult = { rows: ImportRow[]; errors: string[]; ignoredColumns: string[] };

export function rowsFromCsv(text: string): CsvResult {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], errors: ["A planilha está vazia ou só tem o cabeçalho."], ignoredColumns: [] };
  const header = table[0].map((h) => norm(h).replace(/\s*r\s*$/, ""));
  const fields = header.map((h) => HEADERS[h]);
  const ignoredColumns = table[0].filter((_, i) => !fields[i] && table[0][i].trim());
  if (!fields.includes("name") && !fields.includes("sku"))
    return { rows: [], errors: ['Não achei a coluna "Produto" (ou "Código"). Baixe o modelo para ver os nomes das colunas.'], ignoredColumns };

  const rows: ImportRow[] = [];
  const errors: string[] = [];
  for (const [li, cells] of table.slice(1, MAX_ROWS + 1).entries()) {
    const line = li + 2;
    const raw: Record<string, unknown> = {};
    const before = errors.length;
    for (const [ci, field] of fields.entries()) {
      if (!field) continue;
      const v = (cells[ci] ?? "").trim();
      if (!v) continue; // célula vazia = não mexer
      switch (field) {
        case "priceCents": {
          if (/consulta/i.test(v)) raw.priceCents = null;
          else {
            const p = parsePrice(v);
            if (Number.isNaN(p)) errors.push(`Linha ${line}: preço "${v}" não entendido (use 89,90).`);
            else raw.priceCents = p;
          }
          break;
        }
        case "stock": {
          if (/encomenda/i.test(v)) raw.stock = null;
          else if (/^\d{1,6}$/.test(v)) raw.stock = Number(v);
          else errors.push(`Linha ${line}: estoque "${v}" não entendido (use um número ou "encomenda").`);
          break;
        }
        case "size": {
          const s = parseSizeCell(v);
          if (s === "invalid") errors.push(`Linha ${line}: tamanho "${v}" não entendido (ex.: 220 ml, 180 g).`);
          else {
            raw.size = s.size;
            if (s.unit && raw.unit === undefined) raw.unit = s.unit;
          }
          break;
        }
        case "unit": {
          const s = parseSizeCell(`1 ${v}`);
          if (s !== "invalid" && s.unit) raw.unit = s.unit;
          break;
        }
        case "active": {
          const n = norm(v);
          if (YES.has(n)) raw.active = true;
          else if (NO.has(n)) raw.active = false;
          break;
        }
        case "gender": {
          const n = norm(v);
          raw.gender = n.startsWith("fem") ? "feminino" : n.startsWith("masc") ? "masculino" : n.startsWith("uni") ? "unissex" : null;
          break;
        }
        case "notesTop":
        case "notesHeart":
        case "notesBase":
          raw[field] = v.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 20);
          break;
        default:
          raw[field] = v;
      }
    }
    if (!raw.name && !raw.sku) continue;
    // Linha com célula que não deu para entender: fica de fora (aparece só no aviso) para não salvar pela metade.
    if (errors.length > before) {
      errors[errors.length - 1] += " Linha ignorada.";
      continue;
    }
    const parsed = importRowSchema.safeParse({ name: "", ...raw });
    if (parsed.success) rows.push(parsed.data);
    else errors.push(`Linha ${line}: ${parsed.error.issues[0]?.message ?? "dados inválidos"}.`);
  }
  if (table.length - 1 > MAX_ROWS) errors.push(`Só as primeiras ${MAX_ROWS} linhas foram lidas.`);
  return { rows, errors, ignoredColumns };
}

/* ─────────────────────────── Exportação ─────────────────────────── */

export const EXPORT_HEADER = [
  "Código", "Produto", "Categoria", "Tamanho", "Unidade", "Rótulo", "Preço", "Estoque", "À venda",
  "Família olfativa", "Público", "Notas de saída", "Notas de coração", "Notas de fundo", "Descrição",
];

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV com ; e BOM: abre certo no Excel brasileiro e no Google Planilhas. */
export function toCsv(rows: unknown[][]) {
  return "﻿" + [EXPORT_HEADER, ...rows].map((r) => r.map(esc).join(";")).join("\r\n") + "\r\n";
}
