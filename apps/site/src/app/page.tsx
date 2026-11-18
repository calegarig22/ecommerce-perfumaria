import Image from "next/image";
import Link from "next/link";
import { HeroFeature } from "@/components/hero-feature";
import { ProductCard } from "@/components/product-card";
import { getCatalog, linePhoto } from "@/lib/catalog";
import { familyTint } from "@/lib/format";
import { whatsappLink } from "@/lib/site";

const families = [
  { name: "Floral", text: "Rosa, jasmim, tuberosa" },
  { name: "Frutado", text: "Pera, pêssego, frutas vermelhas" },
  { name: "Oriental", text: "Baunilha, âmbar, especiarias" },
  { name: "Amadeirado", text: "Cedro, sândalo, vetiver" },
  { name: "Aromático", text: "Ervas, lavanda, notas aquáticas" },
  { name: "Chipre", text: "Cítricos, musgo, patchouli" },
];

/** Fundos neutros e quentes para os painéis das linhas. */
const lineTone: Record<string, string> = {
  perfume: "#f1e7df",
  "body-splash": "#ece6dc",
  "perfume-cabelo": "#efe3dd",
};
const TONES = ["#f1e7df", "#ece6dc", "#efe3dd", "#ebe4da", "#f0e6e0"];
const toneOf = (slug: string, i: number) => lineTone[slug] ?? TONES[i % TONES.length];

function SectionTitle({ id, children, sub }: { id: string; children: React.ReactNode; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 id={id} className="font-display text-[2.1rem] leading-tight sm:text-[2.75rem]">
        {children}
      </h2>
      {sub && <p className="mx-auto mt-4 max-w-md text-ink/70">{sub}</p>}
    </div>
  );
}

export default async function Home() {
  const { lines, products } = await getCatalog();
  const featured = products.filter((p) => p.featured);
  // Vitrine: destaques primeiro, completando com perfumes e body splash variados.
  const showcase = [...featured, ...products.filter((p) => !p.featured && p.line.slug !== "perfume-cabelo")]
    .filter((p, i, arr) => arr.findIndex((x) => x.fragranceSlug === p.fragranceSlug) === i)
    .slice(0, 8);
  const countByLine = (slug: string) => products.filter((p) => p.line.slug === slug).length;

  return (
    <>
      {/* Campanha: frascos reais compostos, texto centralizado */}
      <section
        aria-labelledby="titulo"
        className="relative isolate overflow-hidden"
        style={{ background: "radial-gradient(120% 85% at 50% 100%, #ead9cb 0%, #f4ece5 45%, #faf7f3 100%)" }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center px-4 pt-14 text-center sm:px-6 sm:pt-20 lg:pt-24">
          <p className="label-caps text-[0.7rem] text-ink/60">Perfumaria artesanal</p>
          <h1 id="titulo" className="mt-5 max-w-4xl font-display display-tight text-[clamp(2.4rem,6vw,5rem)]">
            Fragrâncias artesanais feitas em pequenos lotes.
          </h1>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
            <Link href="/loja" className="btn-primary min-w-56">
              Descobrir a coleção
            </Link>
            <a
              href={whatsappLink("Olá! Quero ajuda para escolher uma fragrância.")}
              target="_blank"
              rel="noopener noreferrer"
              className="label-caps link-quiet inline-flex min-h-11 items-center text-[0.7rem]"
            >
              Ajuda para escolher
            </a>
          </div>
        </div>

        {/* Prateleira com os três frascos */}
        <div className="relative mx-auto mt-10 flex h-[clamp(15rem,42vw,30rem)] max-w-4xl items-end justify-center gap-[3%] px-4 sm:mt-14">
          <span aria-hidden className="absolute bottom-[6%] left-1/2 h-[10%] w-[70%] -translate-x-1/2 rounded-[50%] bg-ink/10 blur-2xl" />
          <Image
            src={linePhoto("body-splash", "feminino")!}
            alt="Body Splash"
            width={279}
            height={917}
            priority
            sizes="(min-width: 1024px) 150px, 18vw"
            className="relative z-10 mb-[4%] h-[86%] w-auto object-contain drop-shadow-[0_24px_28px_rgb(46_36_32/0.22)]"
          />
          <Image
            src={linePhoto("perfume", "feminino")!}
            alt="Perfume feminino"
            width={451}
            height={533}
            priority
            sizes="(min-width: 1024px) 340px, 40vw"
            className="relative z-20 mb-[3%] h-[78%] w-auto object-contain drop-shadow-[0_28px_32px_rgb(46_36_32/0.25)]"
          />
          <Image
            src={linePhoto("perfume", "masculino")!}
            alt="Perfume masculino"
            width={332}
            height={373}
            priority
            sizes="(min-width: 1024px) 260px, 30vw"
            className="relative z-10 mb-[4%] h-[58%] w-auto object-contain drop-shadow-[0_24px_28px_rgb(46_36_32/0.22)]"
          />
        </div>
      </section>

      {/* Linhas: painéis grandes, quase de ponta a ponta */}
      <section aria-labelledby="linhas" className="px-2 pt-24 sm:px-3 lg:pt-32">
        <SectionTitle id="linhas" sub="A mesma assinatura olfativa na pele, nos cabelos e na sua casa.">
          As linhas
        </SectionTitle>
        <ul className="mt-12 grid gap-2 sm:grid-cols-3 sm:gap-3">
          {lines.map((l, i) => (
            <li key={l.slug}>
              <Link
                href={`/loja?linha=${l.slug}`}
                className="group relative flex aspect-[4/5] flex-col items-center justify-end overflow-hidden px-6 pb-8 text-center sm:aspect-[3/4] lg:pb-12"
                style={{ background: toneOf(l.slug, i) }}
              >
                {l.cover && (
                <Image
                  src={l.cover}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 33vw, 100vw"
                  className={`object-contain drop-shadow-[0_22px_26px_rgb(46_36_32/0.2)] transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04] ${
                    l.slug === "perfume-cabelo" ? "object-left pb-[34%] pr-[22%] pt-[8%]" : "px-[24%] pb-[34%] pt-[10%]"
                  }`}
                />
                )}
                <div className="relative">
                  <h3 className="font-display text-[1.9rem] leading-none lg:text-[2.25rem]">{l.name}</h3>
                  <p className="mt-2 text-sm text-ink/60">{countByLine(l.slug)} {countByLine(l.slug) === 1 ? "opção" : "opções"}</p>
                  <span className="label-caps mt-5 inline-block border-b border-ink/40 pb-1 text-[0.68rem] transition-colors group-hover:border-ink">
                    Descobrir
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Destaques */}
      <section aria-labelledby="vitrine" className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-10 lg:pt-32">
        <SectionTitle id="vitrine">Destaques</SectionTitle>
        <ul className="mt-12 grid grid-cols-2 gap-x-3 gap-y-12 sm:gap-x-6 md:grid-cols-4">
          {showcase.map((p) => (
            <li key={p.slug}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
        <div className="mt-14 text-center">
          <Link href="/loja" className="btn-secondary min-w-64">
            Ver todos os {products.length} produtos
          </Link>
        </div>
      </section>

      {/* Pelas notas */}
      <section aria-labelledby="notas-destaque" className="mx-auto max-w-5xl px-4 pt-24 sm:px-6 lg:pt-32">
        <SectionTitle id="notas-destaque" sub="Cada fragrância se revela em três tempos: saída, coração e fundo.">
          Descubra pelas notas
        </SectionTitle>
        <div className="mt-12">
          <HeroFeature products={featured} />
        </div>
      </section>

      {/* Famílias */}
      <section aria-labelledby="familias" className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-10 lg:pt-32">
        <SectionTitle id="familias" sub="Comece pela família que mais combina com você.">
          Famílias olfativas
        </SectionTitle>
        <ul className="mt-12 grid grid-cols-2 border-l border-t border-line md:grid-cols-3 lg:grid-cols-6">
          {families.map((f) => (
            <li key={f.name} className="border-b border-r border-line">
              <Link
                href={`/loja?familia=${encodeURIComponent(f.name)}`}
                className="group flex h-full flex-col items-center px-3 py-8 text-center transition-colors hover:bg-linen sm:py-10"
              >
                <span aria-hidden className="size-3 rounded-pill" style={{ background: familyTint(f.name) }} />
                <span className="mt-4 font-display text-[1.45rem] leading-none">{f.name}</span>
                <span className="mt-2 text-[0.8rem] leading-snug text-ink/60">{f.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Essência */}
      <section aria-labelledby="essencia" className="mt-24 bg-linen lg:mt-32">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:py-32">
          <h2 id="essencia" className="label-caps text-[0.7rem] text-ink/60">
            Sobre
          </h2>
          <p className="mt-8 font-display text-[clamp(1.7rem,3.6vw,2.75rem)] leading-snug">
            Texto institucional de exemplo: uma perfumaria artesanal fictícia, usada para demonstrar a loja.
          </p>
          <Link
            href="/sobre"
            className="label-caps mt-10 inline-block border-b border-ink/40 pb-1 text-[0.7rem] transition-colors hover:border-ink"
          >
            Conheça a loja
          </Link>
        </div>
      </section>

      {/* Como comprar */}
      <section aria-labelledby="como-comprar" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
        <SectionTitle id="como-comprar">Como comprar</SectionTitle>
        <ol className="mt-14 grid gap-12 text-center md:grid-cols-3">
          {[
            ["Escolha", "Navegue pela loja, conheça as notas e coloque suas fragrâncias na sacola."],
            ["Envie pelo WhatsApp", "Um toque e o pedido chega pronto para nós, com os itens escolhidos."],
            ["Receba com cuidado", "Confirmamos valores, frete e pagamento, e separamos seu pedido à mão."],
          ].map(([title, text], i) => (
            <li key={title} className="mx-auto max-w-xs">
              <span aria-hidden className="font-display text-4xl text-caramel">
                {i + 1}
              </span>
              <span className="label-caps mt-4 block text-[0.72rem]">{title}</span>
              <span className="mt-3 block text-ink/70">{text}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
