import { formatSize } from "@perfumaria/db/units";
import type { Gender, Variant } from "./types";

export { formatSize };

/** Tamanho mostrado no card/página: o da primeira variação com tamanho ("220 ml", "180 g"). */
export function mainSize(variants: Variant[]) {
  const v = variants.find((x) => x.size || x.label);
  return v ? formatSize(v.size, v.unit, v.label) : "";
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatPrice(cents: number | null) {
  return cents == null ? null : brl.format(cents / 100);
}

export function priceLabel(variants: Variant[]) {
  const prices = variants.map((v) => v.priceCents).filter((p): p is number => p != null);
  if (!prices.length) return "Preço sob consulta";
  const min = Math.min(...prices);
  return prices.length > 1 && Math.max(...prices) !== min ? `a partir de ${formatPrice(min)}` : formatPrice(min)!;
}

export const genderLabel: Record<Gender, string> = {
  feminino: "Feminino",
  masculino: "Masculino",
  unissex: "Unissex",
};

/** Família principal = primeira palavra ("Oriental Floral" → "Oriental"). */
export const mainFamily = (family: string) => family.split(" ")[0];

/** Tom do líquido por família principal — usado na ilustração do frasco. */
const FAMILY_TINT: Record<string, string> = {
  Floral: "#e7bdb1",
  Frutado: "#ecbf9d",
  Oriental: "#d39a63",
  Amadeirado: "#b98b65",
  Aromático: "#bcc7b3",
  Chipre: "#cdb98f",
};

export function familyTint(family: string) {
  return FAMILY_TINT[mainFamily(family)] ?? "#d9b896";
}

function mix(hex: string, target: string, amount: number) {
  const a = hex.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const b = target.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, "0")).join("")}`;
}

/** Tons das famílias e facetas ("Oriental *Baunilha*"), mais distintos entre si. */
const FACET_TINT: Record<string, string> = {
  Floral: "#e2b1bb",
  Frutado: "#f0b28f",
  Oriental: "#cf955c",
  Amadeirado: "#ad8768",
  Aromático: "#a9c0a5",
  Chipre: "#bdb47f",
  Gourmand: "#d39c6b",
  Especiado: "#c47c55",
  Aquático: "#9cc4cf",
  Baunilha: "#ead29b",
  Fougère: "#9fb394",
  Fresco: "#b5d7c9",
};

/**
 * Cor do ingrediente mais marcante. Ordem = prioridade (o mais característico primeiro).
 * Ex.: Aurora (pera) puxa para tons frutados; Brisa (notas aquáticas) para azul-mar.
 */
const NOTE_TINT: [RegExp, string][] = [
  [/\boud\b|couro|fumaça|incenso|castóreo/i, "#8e6b58"],
  [/café|cacau/i, "#9c7356"],
  [/aquátic|oceân|marinh|algas|água de coco|\bsal\b/i, "#8fbfd0"],
  [/lavanda|lilás|violeta|íris|orris|heliotrópio/i, "#b7a5d3"],
  [/morango|cereja|groselha|amora|pitaia|ameixa|maçã vermelha/i, "#d7848f"],
  [/\brosa\b|rosa búlgara|rosa turca|peônia|pomarose/i, "#e6a3b1"],
  [/pêssego|manga|maracujá|frutas tropicais|lichia|melão/i, "#f3b383"],
  [/caramelo|pralinê|\bmel\b|açúcar|leite|castanha|avelã/i, "#d9a46e"],
  [/baunilha|fava tonka|benjoim/i, "#ecd59e"],
  [/limão|bergamota|tangerina|mandarina|laranja|toranja|cidra|\blima\b|petitgrain/i, "#efd98a"],
  [/hortelã|sálvia|alecrim|louro|coentro|elemi|cipreste|zimbro|bambu/i, "#a5c39b"],
  [/canela|pimenta|noz-moscada|gengibre|cardamomo/i, "#c98454"],
  [/jasmim|tuberosa|gardênia|flor de laranjeira|néroli|lírio|magnólia|frésia|ylang|orquídea/i, "#f2e2cf"],
  [/cedro|sândalo|vetiver|madeira|patchouli|guaiac|musgo/i, "#b4927a"],
];

export function signatureTint(notes: { top: string[]; heart: string[]; base: string[] }) {
  const all = [...notes.heart, ...notes.top, ...notes.base].join(", ");
  return NOTE_TINT.find(([re]) => re.test(all))?.[1] ?? null;
}

/**
 * Arte do quadro da foto: degradê da cor da família (topo) para a cor do ingrediente
 * mais marcante (base), e a cor do nome gravado ao fundo. Frascos iguais, identidades diferentes.
 */
export function tileArt(family: string, notes?: { top: string[]; heart: string[]; base: string[] }) {
  const words = family.split(" ");
  const a = FACET_TINT[words[0]] ?? "#d9b896";
  const b = (notes && signatureTint(notes)) ?? FACET_TINT[words[1] ?? ""] ?? a;
  return {
    background: `linear-gradient(175deg, ${mix(a, "#faf7f3", 0.8)} 0%, ${mix(a, "#faf7f3", 0.64)} 40%, ${mix(b, "#faf7f3", 0.4)} 100%)`,
    ink: mix(a, "#2e2420", 0.5),
  };
}

/** Três notas que resumem a fragrância: a primeira de saída, de coração e de fundo. */
export function keyNotes(notes: { top: string[]; heart: string[]; base: string[] }) {
  return [notes.top[0], notes.heart[0], notes.base[0]].filter(Boolean) as string[];
}

/** Camadas do líquido: saída (clara) → coração → fundo (profunda). */
export function strata(family: string) {
  const t = familyTint(family);
  return { top: mix(t, "#ffffff", 0.45), heart: t, base: mix(t, "#5a3a24", 0.32) };
}
