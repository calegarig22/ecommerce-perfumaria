/** Dados públicos da marca. Seguro para importar em client components. */
const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "5500000000000";
const instagram = process.env.NEXT_PUBLIC_INSTAGRAM ?? "perfumaria.exemplo";

export const site = {
  name: "Perfumaria Exemplo",
  tagline: "Fragrâncias artesanais feitas em pequenos lotes.",
  description:
    "Perfumaria artesanal (marca fictícia): perfumes, body splash, perfume para cabelo e aromas para a casa, com produção própria em pequenos lotes.",
  whatsappNumber,
  whatsappDisplay: process.env.NEXT_PUBLIC_WHATSAPP_DISPLAY ?? "(00) 00000-0000",
  instagram,
  instagramUrl: `https://www.instagram.com/${instagram}/`,
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? (null as string | null),
} as const;

/** Liga a indexação no Google. Manter false até o lançamento oficial. */
export const indexable = process.env.NEXT_PUBLIC_SITE_INDEXABLE === "true";

export function whatsappLink(message: string) {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
