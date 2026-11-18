/** Tipos públicos do catálogo — o que pode ir para o navegador. */

/** Slug da categoria. Livre: a dona cria categorias novas pelo painel. */
export type LineSlug = string;
export type Gender = "feminino" | "masculino" | "unissex";

export type Line = {
  slug: LineSlug;
  name: string;
  shortName: string;
  description: string;
  /** Foto de capa da categoria na home (frasco padrão ou foto do 1º produto). */
  cover: string | null;
};

export type Notes = { top: string[]; heart: string[]; base: string[] };

export type Variant = {
  sku: string;
  size: number | null;
  /** ml, g ou un. */
  unit: string;
  label: string | null;
  priceCents: number | null;
  inStock: boolean;
};

export type Product = {
  slug: string;
  fragranceSlug: string;
  name: string;
  family: string;
  /** null = não se aplica (casa, acessórios). */
  gender: Gender | null;
  notes: Notes;
  description: string | null;
  line: Line;
  variants: Variant[];
  images: { url: string; alt: string }[];
  featured: boolean;
};
