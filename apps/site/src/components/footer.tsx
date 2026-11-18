import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import { site, whatsappLink } from "@/lib/site";
import { InstagramIcon, WhatsAppIcon } from "./icons";

export async function Footer() {
  const { lines } = await getCatalog();
  return (
    <footer className="bg-ink text-nude">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-16 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr] lg:px-10 lg:pt-20">
        <div>
          <p className="font-display text-3xl text-paper">{site.name}</p>
          <p className="mt-6 max-w-xs font-display text-2xl leading-snug text-nude">{site.tagline}</p>
        </div>

        <nav aria-label="Rodapé">
          <h2 className="label-caps text-caramel">Loja</h2>
          <ul className="mt-3">
            <li><Link className="flex min-h-11 items-center hover:text-paper" href="/loja">Todos os produtos</Link></li>
            {lines.map((l) => (
              <li key={l.slug}>
                <Link className="flex min-h-11 items-center hover:text-paper" href={`/loja?linha=${l.slug}`}>{l.name}</Link>
              </li>
            ))}
            <li><Link className="flex min-h-11 items-center hover:text-paper" href="/sobre">Sobre</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="label-caps text-caramel">Atendimento</h2>
          <ul className="mt-3">
            <li>
              <a
                className="flex min-h-11 items-center gap-3 hover:text-paper"
                href={whatsappLink("Olá! Quero ajuda para escolher uma fragrância.")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon className="size-5" /> {site.whatsappDisplay}
              </a>
            </li>
            <li>
              <a className="flex min-h-11 items-center gap-3 hover:text-paper" href={site.instagramUrl} target="_blank" rel="noopener noreferrer">
                <InstagramIcon className="size-5" /> @{site.instagram}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-nude/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 pb-24 text-xs text-nude/60 sm:flex-row sm:justify-between sm:px-6 sm:pb-6 lg:px-10">
          <p>© Perfumaria Exemplo. Perfumaria artesanal.</p>
          <p>Imagens ilustrativas.</p>
        </div>
      </div>
    </footer>
  );
}
