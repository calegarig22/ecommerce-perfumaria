import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sobre",
  description: "Sobre a Perfumaria Exemplo, perfumaria artesanal fictícia.",
};

const values = [
  ["Qualidade", "Texto de exemplo sobre seleção de matérias-primas e cuidado na produção."],
  ["Transparência", "Texto de exemplo sobre relação com clientes e fornecedores."],
  ["Cuidado", "Texto de exemplo sobre atendimento e experiência de compra."],
];

export default function SobrePage() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:px-10 lg:pb-24 lg:pt-20">
        <h1 className="font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-tight">{site.name}</h1>
        <p className="mt-10 max-w-3xl font-display text-[clamp(1.75rem,3.6vw,2.75rem)] leading-tight">
          Página institucional de demonstração. Marca e textos fictícios.
        </p>
      </section>

      <section aria-labelledby="valores" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <h2 id="valores" className="font-display text-3xl sm:text-4xl">
          Valores
        </h2>
        <dl className="mt-10 grid gap-x-16 md:grid-cols-2">
          {values.map(([name, text]) => (
            <div key={name} className="border-t border-line py-6">
              <dt className="font-display text-2xl">{name}</dt>
              <dd className="mt-2 max-w-md text-ink/75">{text}</dd>
            </div>
          ))}
        </dl>
        <Link href="/loja" className="btn-primary mt-12">
          Conhecer as fragrâncias
        </Link>
      </section>
    </>
  );
}
