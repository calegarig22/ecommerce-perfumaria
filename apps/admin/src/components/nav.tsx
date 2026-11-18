"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/produtos", label: "Produtos" },
  { href: "/produtos/novo", label: "+ Novo produto" },
  { href: "/categorias", label: "Categorias" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/historico", label: "Histórico" },
  { href: "/conta", label: "Minha conta" },
];

/** Barra fixa no celular: o que a dona mais usa, ao alcance do polegar. */
const TABS = [
  { href: "/", label: "Início", icon: "M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/produtos", label: "Produtos", icon: "M5 8h14l-1.2 12H6.2L5 8zM9 8V6.5a3 3 0 016 0V8" },
  { href: "/produtos/novo", label: "Novo", icon: "M12 5v14M5 12h14", primary: true },
  { href: "/pedidos", label: "Pedidos", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" },
];

export function Nav({ userName, role }: { userName: string; role: string }) {
  const links = role === "Admin" ? [...LINKS.slice(0, -1), { href: "/usuarios", label: "Usuários" }, LINKS[LINKS.length - 1]] : LINKS;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href === "/produtos" ? pathname.startsWith("/produtos") && pathname !== "/produtos/novo" : pathname.startsWith(href);

  async function signOut() {
    await authClient.signOut();
    router.replace("/entrar");
    router.refresh();
  }

  return (
    <>
      <nav id="menu-painel" className={`${open ? "block" : "hidden"} md:block`} aria-label="Painel">
        <ul className="mt-4 space-y-0.5 md:mt-8">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={`block rounded-md px-3 py-2.5 text-sm transition-colors md:py-2 ${
                  isActive(l.href) ? "bg-ink text-paper" : "text-ink hover:bg-nude"
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8 border-t border-line pt-4 text-xs text-muted">
          <p className="truncate px-3">{userName} · {role}</p>
          <button type="button" onClick={signOut} className="mt-2 block px-3 py-1 text-sm text-ink hover:text-danger">
            Sair
          </button>
        </div>
      </nav>

      {/* Celular: barra inferior fixa */}
      <nav
        aria-label="Atalhos"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-5">
          {TABS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(t.href) ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] ${
                  isActive(t.href) ? "text-ink" : "text-muted"
                }`}
              >
                <span className={`grid place-items-center ${t.primary ? "size-9 rounded-full bg-ink text-paper" : "size-6"}`}>
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    <path d={t.icon} />
                  </svg>
                </span>
                {t.label}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="menu-painel"
              onClick={() => {
                setOpen((v) => !v);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] ${open ? "text-ink" : "text-muted"}`}
            >
              <span className="grid size-6 place-items-center">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </span>
              Mais
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
