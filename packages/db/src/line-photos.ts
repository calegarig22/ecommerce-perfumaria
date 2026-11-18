/**
 * Foto padrão por linha (imagens genéricas de placeholder), usada
 * quando o produto não tem foto própria. Arquivos em apps/site/public/produtos e, no painel,
 * em apps/admin/public/frascos (cópia; "/produtos" lá é a página de produtos).
 */
export const LINE_PHOTO: Record<string, { feminino: string; masculino: string }> = {
  perfume: { feminino: "perfume-feminino.png", masculino: "perfume-masculino.png" },
  "body-splash": { feminino: "body-splash.png", masculino: "body-splash.png" },
  "perfume-cabelo": { feminino: "perfume-cabelo.png", masculino: "perfume-cabelo.png" },
};

/** Caminho da foto padrão, ou null para categorias sem frasco padrão (velas, casa...). */
export function linePhoto(line: string, gender: string | null | undefined, base = "/produtos/") {
  const file = LINE_PHOTO[line]?.[gender === "masculino" ? "masculino" : "feminino"];
  return file ? `${base}${file}` : null;
}
