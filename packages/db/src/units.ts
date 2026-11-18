/**
 * Unidades de tamanho dos produtos. Perfumes e aromatizadores em ml, velas em g,
 * kits/acessórios em unidades. Compartilhado entre site e painel.
 */
export const UNITS = ["ml", "g", "un"] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABEL: Record<Unit, string> = {
  ml: "ml (líquidos)",
  g: "g (velas, sólidos)",
  un: "unidades (kits, acessórios)",
};

export const isUnit = (v: unknown): v is Unit => typeof v === "string" && (UNITS as readonly string[]).includes(v);

/** "220 ml", "180 g", "3 un." — ou só o rótulo ("Refil"), ou os dois ("Refil, 250 ml"). */
export function formatSize(size: number | null, unit: string | null, label?: string | null) {
  const u = isUnit(unit) ? unit : "ml";
  const amount = size ? (u === "un" ? `${size} un.` : `${size} ${u}`) : "";
  return [label?.trim(), amount].filter(Boolean).join(", ");
}
