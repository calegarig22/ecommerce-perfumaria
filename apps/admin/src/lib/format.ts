const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatPrice(cents: number | null | undefined) {
  return cents == null ? "Sob consulta" : brl.format(cents / 100);
}

/** "89,90" | "R$ 1.089,90" | "89.9" → centavos. "" → null (sob consulta). Inválido → NaN. */
export function parsePrice(input: string): number | null {
  const s = input.replace(/R\$|\s/g, "").trim();
  if (!s) return null;
  let normalized = s;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100);
}

export function centsToInput(cents: number | null) {
  return cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

export function formatDateTime(d: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(d));
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export { formatSize, UNITS, UNIT_LABEL } from "@perfumaria/db/units";
