import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-10">
      <h1 className="font-display text-5xl">Página não encontrada</h1>
      <p className="mt-4 max-w-md text-ink/75">
        O endereço pode ter mudado ou o produto saiu do catálogo. Veja todas as fragrâncias disponíveis na loja.
      </p>
      <Link href="/loja" className="btn-primary mt-8">
        Ir para a loja
      </Link>
    </div>
  );
}
