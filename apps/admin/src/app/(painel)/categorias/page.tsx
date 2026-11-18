import type { Metadata } from "next";
import Link from "next/link";
import { listCategories } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { UNITS, UNIT_LABEL } from "@/lib/format";
import { createCategory, deleteCategory, updateCategory } from "@/lib/actions/catalog";
import { CategoryOrder } from "./category-order";
import { PageHeader } from "@/components/page-header";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";

export const metadata: Metadata = { title: "Categorias" };

type Cat = Awaited<ReturnType<typeof listCategories>>[number];

function CategoryFields({ c, idp }: { c?: Cat; idp: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      <div className="md:col-span-2">
        <label className="label" htmlFor={`${idp}-name`}>Nome (aparece no site)</label>
        <input id={`${idp}-name`} name="name" required maxLength={40} defaultValue={c?.name} placeholder="Velas aromáticas" className="field" />
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor={`${idp}-short`}>Nome curto <span className="font-normal text-muted">(opcional)</span></label>
        <input id={`${idp}-short`} name="shortName" maxLength={24} defaultValue={c?.shortName} placeholder="Vela" className="field" />
      </div>
      <div>
        <label className="label" htmlFor={`${idp}-unit`}>Tamanhos em</label>
        <select id={`${idp}-unit`} name="unit" defaultValue={c?.unit ?? "ml"} className="field">
          {UNITS.map((u) => (
            <option key={u} value={u}>{UNIT_LABEL[u]}</option>
          ))}
        </select>
      </div>
      {c && <input type="hidden" name="sort" value={c.sort} />}
      <div className="md:col-span-5">
        <label className="label" htmlFor={`${idp}-desc`}>Descrição curta <span className="font-normal text-muted">(opcional)</span></label>
        <input id={`${idp}-desc`} name="description" maxLength={300} defaultValue={c?.description} className="field" />
      </div>
    </div>
  );
}

export default async function CategoriesPage({ searchParams }: PageProps<"/categorias">) {
  await requireUser();
  const sp = await searchParams;
  const categories = await listCategories();

  return (
    <>
      <PageHeader
        title="Categorias"
        subtitle="Tipos de produto da loja: perfume, body splash, velas, aromatizadores... Uma categoria aparece no site quando tem produto à venda."
      />
      {sp.erro === "em-uso" && (
        <p role="alert" className="mb-4 rounded-md bg-danger/10 p-3 text-sm text-danger">
          Essa categoria ainda tem produtos. Exclua os produtos dela antes, ou só desmarque “Visível no site”.
        </p>
      )}
      {sp.excluida === "1" && <p role="status" className="mb-4 rounded-md bg-ok/10 p-3 text-sm text-ok">Categoria excluída.</p>}

      <section className="card mb-8 p-5">
        <h2 className="font-display text-xl">Ordem no site</h2>
        <p className="mt-1 mb-3 text-xs text-muted">Arraste pela alça ⠿ (ou use ↑ ↓). É a ordem dos menus e da página inicial do site.</p>
        <CategoryOrder items={categories.map((c) => ({ id: c.id, name: c.name }))} />
      </section>

      <section className="card mb-8 p-5">
        <h2 className="font-display text-xl">Nova categoria</h2>
        <ActionForm action={createCategory} submitLabel="Criar categoria" pendingLabel="Criando…" className="mt-4">
          <CategoryFields idp="nova" />
        </ActionForm>
      </section>

      <div className="space-y-4">
        <h2 className="font-display text-xl">Editar categorias</h2>
        {categories.map((c) => (
          <details key={c.id} className="card group p-5">
            <summary className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-display text-xl">{c.name}</span>
              {!c.active && <span className="badge bg-nude text-muted">Oculta no site</span>}
              <span className="text-sm text-muted">
                {c.products.total} produto(s), {c.products.active} à venda · tamanhos em {c.unit === "un" ? "unidades" : c.unit} · SKU {c.skuPrefix}
              </span>
              <span className="ml-auto text-sm text-accent group-open:hidden">Editar</span>
            </summary>
            <div className="mt-4 border-t border-line pt-4">
              <ActionForm action={updateCategory.bind(null, c.id)} submitLabel="Salvar categoria">
                <CategoryFields c={c} idp={`c${c.id}`} />
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={c.active} />
                  Visível no site (desmarque para esconder a categoria e todos os produtos dela)
                </label>
                <p className="mt-2 text-xs text-muted">
                  Mudar a unidade vale para produtos novos. Os já cadastrados mantêm a unidade de cada tamanho (editável no produto).
                </p>
              </ActionForm>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
                <Link href={`/produtos?linha=${c.slug}`} className="text-accent hover:underline">Ver produtos desta categoria</Link>
                {c.products.total === 0 ? (
                  <form action={deleteCategory.bind(null, c.id)} className="ml-auto">
                    <ConfirmButton message={`Excluir a categoria ${c.name}?`} className="btn-danger">Excluir categoria</ConfirmButton>
                  </form>
                ) : (
                  <span className="ml-auto text-xs text-muted">Para excluir, a categoria precisa estar vazia.</span>
                )}
              </div>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
