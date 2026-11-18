"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { site, whatsappLink } from "@/lib/site";
import { useCart } from "./cart";
import { InstagramIcon, WhatsAppIcon } from "./icons";

/** Rótulos curtos do menu para as linhas originais; categorias novas usam o nome curto do painel. */
const MENU_LABEL: Record<string, string> = { perfume: "Perfumes", "body-splash": "Body Splash", "perfume-cabelo": "Cabelo" };
/** No desktop cabem 3 categorias ao lado do logo; as demais ficam em Loja, no menu do celular e no rodapé. */
const DESKTOP_LINES = 3;

export type NavLine = { slug: string; name: string; shortName: string };

function Logo({ className }: { className: string }) {
  return <span className={`font-display text-2xl leading-none ${className}`} aria-hidden>{site.name}</span>;
}

function BagButton() {
  const { count, open } = useCart();
  return (
    <button
      type="button"
      onClick={open}
      className="relative -mr-2 grid size-12 place-items-center text-ink/85 hover:text-ink"
      aria-label={count ? `Abrir sacola, ${count} ${count === 1 ? "item" : "itens"}` : "Abrir sacola, vazia"}
    >
      <svg viewBox="0 0 24 24" className="size-[1.45rem]" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
        <path d="M5 8h14l-1.2 12H6.2L5 8z" />
        <path d="M9 8V6.5a3 3 0 016 0V8" />
      </svg>
      {count > 0 && (
        <span className="absolute right-0.5 top-1 grid min-w-5 place-items-center rounded-pill bg-accent px-1 text-[11px] leading-5 text-paper tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

export function Header({ lines }: { lines: NavLine[] }) {
  const nav = [
    { href: "/loja", label: "Loja" },
    ...lines.slice(0, DESKTOP_LINES).map((l) => ({ href: `/loja?linha=${l.slug}`, label: MENU_LABEL[l.slug] ?? l.shortName })),
    { href: "/sobre", label: "Sobre" },
  ];
  const mobileNav = [
    { href: "/loja", label: "Todos os produtos" },
    ...lines.map((l) => ({ href: `/loja?linha=${l.slug}`, label: l.name })),
    { href: "/sobre", label: "Sobre" },
  ];
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o menu ao navegar
  useEffect(() => setMenu(false), [pathname]);

  // Menu aberto: trava a rolagem, foca o "fechar", Esc fecha e devolve o foco.
  useEffect(() => {
    if (!menu) return;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    const trigger = menuButton.current;
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [menu]);

  return (
    <>
      <div className="bg-ink text-nude">
        <p className="mx-auto max-w-7xl px-4 py-2.5 text-center text-[0.8rem] tracking-wide sm:px-6">
          <span className="hidden sm:inline">Perfumaria artesanal, feita à mão. </span>
          <span className="sm:hidden">Feita à mão. </span>
          <a
            href={whatsappLink("Olá! Quero fazer um pedido.")}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-nude/40 underline-offset-4 hover:decoration-nude"
          >
            Pedidos pelo WhatsApp
          </a>
        </p>
      </div>

      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-paper focus:px-3 focus:py-2"
        >
          Pular para o conteúdo
        </a>
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6 lg:h-[5.5rem] lg:px-10">
          <div className="flex items-center">
            <button
              ref={menuButton}
              type="button"
              className="-ml-2 grid size-12 place-items-center lg:hidden"
              aria-expanded={menu}
              aria-controls="menu-mobile"
              aria-label="Abrir menu"
              onClick={() => setMenu(true)}
            >
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
                <path d="M3 8h18M3 16h18" />
              </svg>
            </button>
            <nav aria-label="Principal" className="hidden lg:block">
              <ul className="flex items-center gap-7">
                {nav.map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} className="label-caps py-3 text-ink/75 transition-colors hover:text-ink">
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <Link href="/" className="flex h-12 items-center justify-self-center" aria-label="Perfumaria Exemplo, página inicial">
            <Logo className="h-9 w-auto sm:h-10 lg:h-12" />
          </Link>

          <div className="flex items-center justify-end gap-1">
            <a
              href={site.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden size-12 place-items-center text-ink/75 hover:text-ink sm:grid"
              aria-label="Instagram da loja (abre em nova aba)"
            >
              <InstagramIcon className="size-[1.35rem]" />
            </a>
            <BagButton />
          </div>
        </div>
      </header>

      {/* Menu do celular: tela cheia, FORA do header (o desfoque do header prenderia o position:fixed). */}
      {menu && (
        <div
          id="menu-mobile"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="menu-in fixed inset-0 z-50 flex flex-col bg-paper lg:hidden"
        >
          <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-line px-4 pt-[env(safe-area-inset-top)] sm:px-6">
            <button
              ref={closeButton}
              type="button"
              onClick={() => setMenu(false)}
              className="-ml-2 grid size-12 place-items-center"
              aria-label="Fechar menu"
            >
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <Link href="/" onClick={() => setMenu(false)} className="flex h-12 items-center" aria-label="Perfumaria Exemplo, página inicial">
              <Logo className="h-9 w-auto" />
            </Link>
            <span />
          </div>

          <nav aria-label="Principal" className="flex-1 overflow-y-auto px-6">
            <ul>
              {mobileNav.map((n) => (
                <li key={n.href} className="border-b border-line">
                  <Link
                    href={n.href}
                    onClick={() => setMenu(false)}
                    className="flex min-h-16 items-center justify-between py-3 font-display text-[1.75rem]"
                  >
                    {n.label}
                    <svg viewBox="0 0 24 24" className="size-5 text-muted" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="grid grid-cols-2 gap-3 border-t border-line px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
            <a
              href={whatsappLink("Olá! Quero ajuda para escolher uma fragrância.")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary gap-2 px-3"
            >
              <WhatsAppIcon className="size-4" /> WhatsApp
            </a>
            <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary gap-2 px-3">
              <InstagramIcon className="size-4" /> Instagram
            </a>
          </div>
        </div>
      )}
    </>
  );
}
