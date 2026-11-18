import type { Metadata } from "next";
import Link from "next/link";
import { listLines, productOptions } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { aiEnabled } from "@/lib/import/ai";
import { PageHeader } from "@/components/page-header";
import { NewProductForm } from "./new-product-form";
import { ImportClient } from "./import-client";
import { BulkPhotos } from "./bulk-photos";

export const metadata: Metadata = { title: "Novo produto" };

const TABS = [
  { v: "um", label: "Um produto", hint: "Foto, nome e preço" },
  { v: "varios", label: "Vários de uma vez", hint: "Planilha ou foto da lista" },
  { v: "fotos", label: "Fotos", hint: "Várias fotos para vários produtos" },
] as const;

/** Tudo para cadastrar num lugar só: um produto, vários (planilha/IA) ou fotos em lote. */
export default async function NewProductPage({ searchParams }: PageProps<"/produtos/novo">) {
  await requireUser();
  const sp = await searchParams;
  const modo = TABS.some((t) => t.v === sp.modo) ? (sp.modo as (typeof TABS)[number]["v"]) : "um";
  const pre = typeof sp.categoria === "string" ? sp.categoria : "";

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/produtos" className="text-accent hover:underline">← Produtos</Link>
      </p>
      <PageHeader title="Novo produto" />

      <nav aria-label="Como cadastrar" className="mb-6 grid grid-cols-3 gap-2">
        {TABS.map((t) => {
          const active = modo === t.v;
          return (
            <Link
              key={t.v}
              href={`/produtos/novo?modo=${t.v}${pre ? `&categoria=${encodeURIComponent(pre)}` : ""}`}
              aria-current={active ? "page" : undefined}
              className={`rounded-md border p-3 ${active ? "border-ink bg-ink text-paper" : "border-line-strong bg-paper hover:border-ink"}`}
            >
              <span className="block text-sm font-medium">{t.label}</span>
              <span className={`hidden text-xs sm:block ${active ? "text-paper/75" : "text-muted"}`}>{t.hint}</span>
            </Link>
          );
        })}
      </nav>

      {modo === "um" && <NewOne pre={pre} />}
      {modo === "varios" && <ImportClient aiOn={aiEnabled()} />}
      {modo === "fotos" && <Photos />}
    </>
  );
}

async function NewOne({ pre }: { pre: string }) {
  const lines = (await listLines()).filter((l) => l.active);
  return <NewProductForm lines={lines.map(({ id, name, slug, unit }) => ({ id, name, slug, unit }))} pre={pre} />;
}

async function Photos() {
  const options = await productOptions();
  return (
    <>
      <p className="mb-4 text-sm text-muted">
        Para pôr foto em produtos já cadastrados: escolha várias fotos, confira o produto de cada uma e envie.
      </p>
      <BulkPhotos options={options.map(({ id, name, line, lineShort, photos, hasDefault }) => ({ id, name, line, lineShort, photos, hasDefault }))} />
    </>
  );
}
