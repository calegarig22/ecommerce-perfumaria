"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { whatsappLink } from "@/lib/site";
import { WhatsAppIcon } from "./icons";

/**
 * Botão fixo "Fale conosco" (canto inferior direito).
 * No celular: mostra o texto no topo da página e encolhe para só o ícone ao rolar,
 * para não cobrir produtos. Na página de produto, sobe para não ficar sobre a barra de compra.
 */
export function WhatsAppButton() {
  const [compact, setCompact] = useState(false);
  const pathname = usePathname();
  const onProduct = /^\/loja\/[^/]+$/.test(pathname);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <a
      href={whatsappLink("Olá! Vim pelo site e gostaria de falar com vocês.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco pelo WhatsApp (abre em nova aba)"
      className={`group fixed right-4 z-30 flex items-center rounded-pill bg-ink p-1.5 text-paper shadow-[0_8px_24px_-8px_rgb(46_36_32/0.5)] transition-[transform,padding] duration-300 hover:-translate-y-0.5 sm:right-6 sm:bottom-6 sm:pr-5 ${
        onProduct ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]" : "bottom-[max(1rem,env(safe-area-inset-bottom))]"
      } ${compact ? "pr-1.5" : "pr-5"}`}
    >
      <span className="grid size-11 place-items-center rounded-pill bg-[#25d366] text-white">
        <WhatsAppIcon className="size-[1.4rem]" />
      </span>
      <span
        className={`label-caps overflow-hidden whitespace-nowrap text-[0.72rem] transition-[max-width,margin,opacity] duration-300 sm:ml-2.5 sm:max-w-40 sm:opacity-100 ${
          compact ? "ml-0 max-w-0 opacity-0" : "ml-2.5 max-w-40 opacity-100"
        }`}
      >
        Fale conosco
      </span>
    </a>
  );
}
