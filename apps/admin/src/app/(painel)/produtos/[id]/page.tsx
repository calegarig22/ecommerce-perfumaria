import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, listLines } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { env } from "@/lib/env";
import { centsToInput, UNITS } from "@/lib/format";
import { addToCategory, deleteProduct, duplicateProduct, saveVariants, updateFragrance, updateProductFlags, uploadImage } from "@/lib/actions/catalog";
import { PageHeader } from "@/components/page-header";
import { ActionForm } from "@/components/action-form";
import { FragranceFields } from "@/components/fragrance-fields";
import { ConfirmButton } from "@/components/confirm-button";
import { ImageList } from "./image-list";
import { PhotoUploader } from "@/components/photo-uploader";
import { linePhoto } from "@perfumaria/db/line-photos";

export const metadata: Metadata = { title: "Editar produto" };

export default async function ProductPage({ params, searchParams }: PageProps<"/produtos/[id]">) {
  await requireUser();
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const [data, allLines] = await Promise.all([getProduct(Number(id)), listLines()]);
  if (!data) notFound();
  const { product, fragrance, line, variants, images, siblings } = data;
  const sp = await searchParams;
  const created = sp.criado === "1";
  const confirmError = sp.erro === "confirmacao";
  const photoErrors = typeof sp.fotos === "string" ? Number(sp.fotos) || 0 : 0;
  const siteUrl = new URL(`/loja/${product.slug}`, env().SITE_URL).toString();
  const blobReady = !!env().BLOB_READ_WRITE_TOKEN || process.env.NODE_ENV === "development";
  const otherLines = allLines.filter((l) => !siblings.some((sb) => sb.lineId === l.id));
  const unitName = (u: string) => (u === "un" ? "un." : u);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/produtos" className="text-accent hover:underline">← Produtos</Link>
      </p>
      <PageHeader
        title={`${fragrance.name} · ${line.shortName}`}
        subtitle={
          <>
            {line.name}
            {fragrance.family ? ` · ${fragrance.family}` : ""} ·{" "}
            {product.active ? (
              <a href={siteUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">ver no site ↗</a>
            ) : (
              "oculto no site"
            )}
          </>
        }
      />
      {created && (
        <p role="status" className="mb-6 rounded-md bg-ok/10 p-3 text-sm text-ok">{product.active
            ? `Produto criado e já à venda no site.${images.length ? "" : " Que tal pôr uma foto?"}`
            : "Produto criado (oculto no site). Confira os dados, adicione fotos e marque “À venda no site”."}</p>
      )}
      {photoErrors > 0 && (
        <p role="alert" className="mb-6 rounded-md bg-danger/10 p-3 text-sm text-danger">
          {photoErrors} foto(s) não foram salvas. Tente enviá-las de novo em Fotos.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5 xl:col-span-2">
          <h2 className="font-display text-xl">Fotos</h2>
          <p className="mt-1 text-xs text-muted">
            A primeira foto é a principal: é a que aparece no site.
          </p>
          <ImageList productId={product.id} images={images} defaultPhoto={linePhoto(line.slug, fragrance.gender, "/frascos/")} />
          {blobReady ? (
            <PhotoUploader upload={uploadImage.bind(null, product.id)} altBase={`${line.shortName} ${fragrance.name}`} />
          ) : (
            <p className="mt-4 rounded-md bg-nude p-3 text-sm">
              Envio de fotos ainda não ativado: falta conectar o armazenamento (Vercel Blob).
            </p>
          )}
        </section>

        <section className="card p-5 xl:col-span-2">
          <h2 className="font-display text-xl">Venda</h2>
          <ActionForm action={updateProductFlags.bind(null, product.id)} submitLabel="Salvar">
            <div className="mt-4 space-y-3 text-sm">
              <label className="flex items-start gap-3">
                <input type="checkbox" name="active" defaultChecked={product.active} className="mt-1" />
                <span>
                  <strong>À venda no site</strong>
                  <span className="block text-muted">Desmarque para esconder sem apagar (pedidos antigos continuam intactos).</span>
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" name="featured" defaultChecked={product.featured} className="mt-1" />
                <span>
                  <strong>Destaque na página inicial</strong>
                </span>
              </label>
            </div>
          </ActionForm>
        </section>

        <section className="card p-5 xl:col-span-2">
          <h2 className="font-display text-xl">Preço e estoque</h2>
          <p className="mt-1 text-xs text-muted">
            Preço vazio = “sob consulta”. Estoque vazio = feito sob encomenda (não controla quantidade). Rótulo é opcional
            (ex.: “Refil”, “Kit com 3”).
          </p>
          <ActionForm action={saveVariants.bind(null, product.id)} submitLabel="Salvar preço e estoque">
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted uppercase">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Tamanho</th>
                    <th className="py-1 pr-3 font-medium">Rótulo</th>
                    <th className="py-1 pr-3 font-medium">Preço (R$)</th>
                    <th className="py-1 pr-3 font-medium">Estoque</th>
                    <th className="py-1 font-medium">À venda</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.id}>
                      <td className="py-1 pr-3">
                        <div className="flex items-center gap-1">
                          <input name={`v${v.id}-size`} defaultValue={v.size ?? ""} inputMode="numeric" className="field w-20 py-1" aria-label={`Tamanho ${v.sku}`} />
                          <select name={`v${v.id}-unit`} defaultValue={v.unit} className="field w-auto py-1" aria-label={`Unidade ${v.sku}`}>
                            {UNITS.map((u) => (
                              <option key={u} value={u}>{unitName(u)}</option>
                            ))}
                          </select>
                        </div>
                        <span className="block font-mono text-[0.6875rem] text-muted" title="Código do produto">cód. {v.sku}</span>
                      </td>
                      <td className="py-1 pr-3">
                        <input name={`v${v.id}-label`} defaultValue={v.label ?? ""} maxLength={40} placeholder="—" className="field w-28 py-1" aria-label={`Rótulo ${v.sku}`} />
                      </td>
                      <td className="py-1 pr-3">
                        <input name={`v${v.id}-price`} defaultValue={centsToInput(v.priceCents)} placeholder="sob consulta" inputMode="decimal" className="field w-32 py-1" aria-label={`Preço ${v.sku}`} />
                      </td>
                      <td className="py-1 pr-3">
                        <input name={`v${v.id}-stock`} defaultValue={v.stock ?? ""} placeholder="encomenda" inputMode="numeric" className="field w-28 py-1" aria-label={`Estoque ${v.sku}`} />
                      </td>
                      <td className="py-1">
                        <input type="checkbox" name={`v${v.id}-active`} defaultChecked={v.active} aria-label={`Tamanho ${v.sku} à venda`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="mt-4 text-sm">
              <summary className="text-accent">+ Adicionar outro tamanho ou opção</summary>
              <div className="mt-3 flex flex-wrap gap-3">
                <div>
                  <label className="label" htmlFor="new-size">Tamanho</label>
                  <div className="flex items-center gap-1">
                    <input id="new-size" name="new-size" inputMode="numeric" className="field w-24" />
                    <select name="new-unit" defaultValue={line.unit} className="field w-auto" aria-label="Unidade do novo tamanho">
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{unitName(u)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="new-label">Rótulo (opcional)</label>
                  <input id="new-label" name="new-label" maxLength={40} placeholder="Refil" className="field w-32" />
                </div>
                <div>
                  <label className="label" htmlFor="new-price">Preço (R$)</label>
                  <input id="new-price" name="new-price" inputMode="decimal" placeholder="sob consulta" className="field w-32" />
                </div>
                <div>
                  <label className="label" htmlFor="new-stock">Estoque</label>
                  <input id="new-stock" name="new-stock" inputMode="numeric" placeholder="encomenda" className="field w-28" />
                </div>
              </div>
            </details>
          </ActionForm>
        </section>

        <section className="card p-5 xl:col-span-2">
          <h2 className="font-display text-xl">Dados do produto</h2>
          {siblings.length > 1 && (
            <p className="mt-1 text-xs text-muted">
              Nome, notas e descrição valem para todas as categorias deste produto:{" "}
              {siblings.map((sb, i) => (
                <span key={sb.id}>
                  {i > 0 && ", "}
                  {sb.id === product.id ? <strong>{sb.lineName}</strong> : <Link href={`/produtos/${sb.id}`} className="text-accent hover:underline">{sb.lineName}</Link>}
                </span>
              ))}
              .
            </p>
          )}
          <ActionForm action={updateFragrance.bind(null, fragrance.id)} submitLabel="Salvar dados">
            <FragranceFields f={fragrance} />
          </ActionForm>
        </section>

        {otherLines.length > 0 && (
          <section className="card p-5 xl:col-span-2">
            <h2 className="font-display text-xl">Vender também em outra categoria</h2>
            <p className="mt-1 text-xs text-muted">
              Ex.: a mesma fragrância como perfume, vela ou aromatizador. Entra oculto; você revisa, põe foto e publica.
            </p>
            <ActionForm action={addToCategory.bind(null, fragrance.id)} submitLabel="Adicionar" pendingLabel="Adicionando…">
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="label" htmlFor="add-line">Categoria</label>
                  <select id="add-line" name="lineId" required className="field">
                    {otherLines.map((l) => (
                      <option key={l.id} value={l.id}>{l.name} ({unitName(l.unit)})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="add-size">Tamanho</label>
                  <input id="add-size" name="size" inputMode="numeric" className="field w-24" />
                </div>
                <div>
                  <label className="label" htmlFor="add-price">Preço (R$)</label>
                  <input id="add-price" name="price" inputMode="decimal" placeholder="sob consulta" className="field w-32" />
                </div>
                <div>
                  <label className="label" htmlFor="add-stock">Estoque</label>
                  <input id="add-stock" name="stock" inputMode="numeric" placeholder="encomenda" className="field w-28" />
                </div>
              </div>
            </ActionForm>
          </section>
        )}

        <section className="card p-5 xl:col-span-2">
          <h2 className="font-display text-xl">Copiar como novo produto</h2>
          <p className="mt-1 text-xs text-muted">
            Cria um produto parecido (mesma categoria, tamanhos, preços, notas e descrição) só trocando o nome. Entra escondido e sem
            estoque, para você pôr a foto e publicar.
          </p>
          <ActionForm action={duplicateProduct.bind(null, product.id)} submitLabel="Copiar" pendingLabel="Copiando…">
            <div className="mt-3">
              <label className="label" htmlFor="dup-name">Nome do novo produto</label>
              <input id="dup-name" name="name" required maxLength={60} placeholder={`Ex.: ${fragrance.name} Noir`} className="field max-w-sm" />
            </div>
          </ActionForm>
        </section>

        <section className="card border-danger/30 p-5 xl:col-span-2">
          <h2 className="font-display text-xl text-danger">Excluir produto</h2>
          <p className="mt-1 text-sm text-muted">
            Remove {fragrance.name} da categoria {line.name}, com preços e fotos. Não dá para desfazer.
            {siblings.length === 1 && " Como é a única categoria deste produto, os dados dele também serão excluídos."}{" "}
            Para tirar do site só por um tempo, prefira desmarcar “À venda no site”. Pedidos já feitos não são afetados.
          </p>
          <form action={deleteProduct.bind(null, product.id)} className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="confirm">Para confirmar, digite o nome: {fragrance.name}</label>
              <input id="confirm" name="confirm" required autoComplete="off" className="field w-64" />
            </div>
            <ConfirmButton message={`Excluir ${fragrance.name} · ${line.shortName} definitivamente?`} className="btn-danger">
              Excluir definitivamente
            </ConfirmButton>
            {confirmError && <p role="alert" className="w-full text-sm text-danger">O nome digitado não confere. Nada foi excluído.</p>}
          </form>
        </section>
      </div>
    </>
  );
}
