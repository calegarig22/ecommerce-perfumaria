import { redirect } from "next/navigation";

/** Antigo endereço: importar agora fica dentro de Novo produto. */
export default function ImportPage() {
  redirect("/produtos/novo?modo=varios");
}
