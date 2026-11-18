/**
 * Catálogo inicial de DEMONSTRAÇÃO (produtos fictícios).
 *
 * Usado para:
 *  1. popular o banco (`pnpm db:seed`);
 *  2. fallback local enquanto DATABASE_URL não estiver configurada.
 *
 * `internalReference` é uma anotação de USO INTERNO (atendimento). Nunca é exibida
 * no site nem enviada ao navegador.
 *
 * Preços não definidos → `priceCents: null` ("sob consulta").
 * SKUs gerados no padrão LINHA-FRAGRANCIA.
 */

// Categorias iniciais. A dona cria outras pelo painel (slug livre).
export type LineSlug = "perfume" | "body-splash" | "perfume-cabelo" | "velas" | "aromatizadores";
export type Gender = "feminino" | "masculino" | "unissex";

export type SeedFragrance = {
  slug: string;
  name: string;
  family: string;
  gender: Gender;
  top: string[];
  heart: string[];
  base: string[];
  lines: LineSlug[];
  internalReference: string;
};

export const seedLines: {
  slug: LineSlug;
  name: string;
  shortName: string;
  skuPrefix: string;
  volumeMl: number | null;
  unit: "ml" | "g" | "un";
  description: string;
  sort: number;
}[] = [
  {
    slug: "perfume",
    name: "Perfume",
    shortName: "Perfume",
    skuPrefix: "PF",
    volumeMl: null,
    unit: "ml",
    description:
      "Fragrâncias de alta fixação, produzidas em pequenos lotes e envasadas à mão.",
    sort: 1,
  },
  {
    slug: "body-splash",
    name: "Body Splash",
    shortName: "Body Splash",
    skuPrefix: "BS",
    volumeMl: 220,
    unit: "ml",
    description:
      "Mais leve que o perfume, para borrifar no corpo inteiro ao longo do dia.",
    sort: 2,
  },
  {
    slug: "perfume-cabelo",
    name: "Perfume para cabelo",
    shortName: "Cabelo",
    skuPrefix: "PC",
    volumeMl: null,
    unit: "ml",
    description:
      "Perfuma os fios sem pesar. As mesmas fragrâncias da linha, em versão para o cabelo.",
    sort: 3,
  },
  // Sem produtos no seed: aparecem no site quando a dona cadastrar o primeiro item.
  {
    slug: "velas",
    name: "Velas aromáticas",
    shortName: "Vela",
    skuPrefix: "VL",
    volumeMl: null,
    unit: "g",
    description: "Velas perfumadas com as fragrâncias da casa, para acender e deixar o ambiente com a sua assinatura.",
    sort: 4,
  },
  {
    slug: "aromatizadores",
    name: "Aromatizadores",
    shortName: "Aromatizador",
    skuPrefix: "AR",
    volumeMl: null,
    unit: "ml",
    description: "Difusores e sprays para perfumar a casa, o carro e os tecidos.",
    sort: 5,
  },
];

const P: LineSlug = "perfume";
const BS: LineSlug = "body-splash";
const PC: LineSlug = "perfume-cabelo";

export const seedFragrances: SeedFragrance[] = [
  {
    slug: "aurora",
    name: "Aurora",
    family: "Floral Frutado",
    gender: "feminino",
    top: ["Pera", "Bergamota"],
    heart: ["Frésia", "Rosa"],
    base: ["Almíscar Branco", "Cedro"],
    lines: [P, BS, PC],
    internalReference: "Referência interna fictícia A",
  },
  {
    slug: "brisa",
    name: "Brisa",
    family: "Aromático Aquático",
    gender: "masculino",
    top: ["Toranja", "Mandarina"],
    heart: ["Notas Aquáticas", "Alecrim"],
    base: ["Âmbar", "Vetiver"],
    lines: [P, BS],
    internalReference: "Referência interna fictícia B",
  },
  {
    slug: "bosque",
    name: "Bosque",
    family: "Amadeirado",
    gender: "unissex",
    top: ["Cardamomo", "Limão"],
    heart: ["Lavanda", "Sálvia"],
    base: ["Sândalo", "Patchouli", "Fava Tonka"],
    lines: [P],
    internalReference: "Referência interna fictícia C",
  },
];
