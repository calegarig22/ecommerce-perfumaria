import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopBrowser } from "@/components/shop-browser";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Loja",
  description: "Perfumes, body splash e perfume para cabelo. Filtre por linha, família olfativa ou nota.",
};

export default async function LojaPage() {
  const { products, lines } = await getCatalog();

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-10 lg:pt-14">
      <h1 className="font-display display-tight text-[clamp(2.75rem,6vw,4.75rem)]">Loja</h1>
      <p className="measure mt-3 text-ink/75">
        Escolha a linha, filtre por família ou busque pela nota que você ama.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-muted">Carregando produtos…</p>}>
          <ShopBrowser products={products} lines={lines} />
        </Suspense>
      </div>
    </div>
  );
}
