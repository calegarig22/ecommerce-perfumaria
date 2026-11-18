"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { formatPrice, formatSize } from "@/lib/format";
import { site, whatsappLink } from "@/lib/site";

export type CartItem = {
  sku: string;
  slug: string;
  name: string;
  lineName: string;
  size: number | null;
  unit: string;
  label: string | null;
  priceCents: number | null;
  qty: number;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (sku: string, qty: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
  open: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "loja.sacola.v1";
const MAX_QTY = 20;

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    // Sanitiza: dado do localStorage não é confiável.
    return data
      .filter(
        (i): i is CartItem =>
          i && typeof i.sku === "string" && typeof i.slug === "string" && typeof i.name === "string" && Number.isInteger(i.qty),
      )
      .map((i) => {
        // Sacolas salvas antes das categorias guardavam só volumeMl.
        const old = i as CartItem & { volumeMl?: unknown };
        const size = Number.isInteger(old.size) ? old.size : Number.isInteger(old.volumeMl) ? (old.volumeMl as number) : null;
        return {
          sku: i.sku,
          slug: i.slug,
          name: i.name,
          lineName: typeof i.lineName === "string" ? i.lineName : "",
          size,
          unit: typeof i.unit === "string" ? i.unit : "ml",
          label: typeof i.label === "string" ? i.label.slice(0, 40) : null,
          priceCents: Number.isInteger(i.priceCents) ? i.priceCents : null,
          qty: Math.min(Math.max(1, i.qty), MAX_QTY),
        };
      })
      .slice(0, 50);
  } catch {
    return [];
  }
}

function save(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* modo privado / storage bloqueado: sacola vale só nesta aba */
  }
}

export function orderMessage(items: CartItem[]) {
  const lines = items.map((i) => {
    const size = formatSize(i.size, i.unit, i.label);
    const vol = size ? `, ${size}` : "";
    const price = i.priceCents != null ? ` — ${formatPrice(i.priceCents * i.qty)}` : "";
    return `• ${i.qty}× ${i.name} (${i.lineName}${vol}) [${i.sku}]${price}`;
  });
  return `Olá! Quero fazer este pedido:\n\n${lines.join("\n")}\n\nPode me passar valores, prazo e entrega?`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratar do localStorage só no cliente
    setItems(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) save(items);
  }, [items, hydrated]);

  const add = useCallback<CartCtx["add"]>((item, qty = 1) => {
    setItems((prev) => {
      const found = prev.find((p) => p.sku === item.sku);
      if (found) return prev.map((p) => (p.sku === item.sku ? { ...p, qty: Math.min(p.qty + qty, MAX_QTY) } : p));
      return [...prev, { ...item, qty }];
    });
  }, []);

  const setQty = useCallback((sku: string, qty: number) => {
    setItems((prev) =>
      qty <= 0 ? prev.filter((p) => p.sku !== sku) : prev.map((p) => (p.sku === sku ? { ...p, qty: Math.min(qty, MAX_QTY) } : p)),
    );
  }, []);

  const remove = useCallback((sku: string) => setItems((prev) => prev.filter((p) => p.sku !== sku)), []);
  const clear = useCallback(() => setItems([]), []);
  const open = useCallback(() => dialogRef.current?.showModal(), []);

  const value = useMemo(
    () => ({ items, count: items.reduce((n, i) => n + i.qty, 0), add, setQty, remove, clear, open }),
    [items, add, setQty, remove, clear, open],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <CartDrawer ref={dialogRef} />
    </Ctx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart fora do CartProvider");
  return ctx;
}

function CartDrawer({ ref }: { ref: React.RefObject<HTMLDialogElement | null> }) {
  const { items, setQty, remove } = useContext(Ctx)!;
  const close = () => ref.current?.close();
  const known = items.filter((i) => i.priceCents != null);
  const subtotal = known.reduce((s, i) => s + i.priceCents! * i.qty, 0);
  const hasUnpriced = known.length < items.length;

  return (
    <dialog
      ref={ref}
      aria-labelledby="sacola-titulo"
      className="sacola m-0 ml-auto h-dvh max-h-dvh w-full max-w-md bg-paper p-0 text-ink backdrop:bg-ink/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 id="sacola-titulo" className="font-display text-2xl">
            Sua sacola
          </h2>
          <button
            type="button"
            onClick={close}
            className="-mr-2 grid size-11 place-items-center rounded-pill text-muted hover:text-ink"
            aria-label="Fechar sacola"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-4 px-6">
            <p className="text-lg">Sua sacola está vazia.</p>
            <p className="text-muted">Escolha uma fragrância na loja e ela aparece aqui.</p>
            <Link href="/loja" onClick={close} className="btn-primary">
              Ver a loja
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-6">
              {items.map((i) => (
                <li key={i.sku} className="flex gap-4 py-5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/loja/${i.slug}`} onClick={close} className="inline-flex min-h-11 items-center font-display text-xl hover:text-accent">
                      {i.name}
                    </Link>
                    <p className="-mt-1 text-sm text-muted">
                      {i.lineName}
                      {formatSize(i.size, i.unit, i.label) ? `, ${formatSize(i.size, i.unit, i.label)}` : ""}
                    </p>
                    <p className="mt-1 text-sm">{i.priceCents != null ? formatPrice(i.priceCents) : "Preço sob consulta"}</p>
                  </div>
                  <div className="flex flex-col items-end justify-between gap-2">
                    <div className="flex items-center rounded-pill border border-line">
                      <button
                        type="button"
                        className="grid size-11 place-items-center text-muted hover:text-ink"
                        onClick={() => setQty(i.sku, i.qty - 1)}
                        aria-label={`Diminuir quantidade de ${i.name}`}
                      >
                        −
                      </button>
                      <span className="w-6 text-center tabular-nums" aria-live="polite">
                        {i.qty}
                      </span>
                      <button
                        type="button"
                        className="grid size-11 place-items-center text-muted hover:text-ink"
                        onClick={() => setQty(i.sku, i.qty + 1)}
                        aria-label={`Aumentar quantidade de ${i.name}`}
                      >
                        +
                      </button>
                    </div>
                    <button type="button" onClick={() => remove(i.sku)} className="min-h-11 px-1 text-sm text-muted underline underline-offset-4 hover:text-ink">
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-4 border-t border-line bg-linen px-6 py-6">
              {known.length > 0 && (
                <p className="flex justify-between">
                  <span>Subtotal{hasUnpriced ? " (itens com preço)" : ""}</span>
                  <span className="tabular-nums">{formatPrice(subtotal)}</span>
                </p>
              )}
              <p className="text-sm text-muted">
                O pedido é enviado para o nosso WhatsApp. Lá confirmamos valores, frete e forma de pagamento com você.
              </p>
              <a
                href={whatsappLink(orderMessage(items))}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full"
              >
                Enviar pedido pelo WhatsApp
              </a>
              <p className="text-center text-xs text-muted">{site.whatsappDisplay}</p>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
