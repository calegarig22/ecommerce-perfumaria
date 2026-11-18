import { redirect } from "next/navigation";

/** Antigo endereço: fotos agora ficam dentro de Novo produto. */
export default function PhotosPage() {
  redirect("/produtos/novo?modo=fotos");
}
