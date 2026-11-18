"use client";

import { useRef, useState, useTransition } from "react";
import { reorderCategories } from "@/lib/actions/catalog";

type Item = { id: number; name: string };

/**
 * Ordem das categorias nos menus do site: arrastar pela alça (mouse ou dedo)
 * ou usar ↑ ↓. Salva sozinho ao soltar.
 */
export function CategoryOrder({ items: initial }: { items: Item[] }) {
  const [items, setItems] = useState(initial);
  const [dragId, setDragId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);
  const startOrder = useRef<number[]>([]);

  const save = (next: Item[]) => {
    if (next.map((i) => i.id).join() === startOrder.current.join()) return;
    start(async () => {
      setStatus("Salvando…");
      const res = await reorderCategories(next.map((i) => i.id));
      setStatus(res.ok ? "Ordem salva. O site já mostra." : res.message);
    });
  };

  const move = (from: number, to: number, list = items) => {
    if (to < 0 || to >= list.length || from === to) return list;
    const next = [...list];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    return next;
  };

  function onPointerDown(e: React.PointerEvent, id: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startOrder.current = items.map((i) => i.id);
    setDragId(id);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragId == null || !listRef.current) return;
    const rows = [...listRef.current.querySelectorAll<HTMLElement>("[data-row]")];
    const from = items.findIndex((i) => i.id === dragId);
    // Posição alvo: quantas linhas (fora a arrastada) têm o meio acima do dedo.
    let to = 0;
    rows.forEach((r, idx) => {
      if (idx === from) return;
      const b = r.getBoundingClientRect();
      if (e.clientY > b.top + b.height / 2) to++;
    });
    if (to !== from) setItems((cur) => move(from, to, cur));
  }

  function onPointerUp() {
    if (dragId == null) return;
    setDragId(null);
    save(items);
  }

  return (
    <div>
      <ul ref={listRef} className="divide-y divide-line rounded-md border border-line bg-paper" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {items.map((it, i) => (
          <li
            key={it.id}
            data-row
            className={`flex items-center gap-3 px-3 py-2 ${dragId === it.id ? "relative z-10 bg-nude shadow-md" : ""}`}
          >
            <button
              type="button"
              onPointerDown={(e) => onPointerDown(e, it.id)}
              className="grid size-9 cursor-grab touch-none place-items-center rounded-md text-lg text-muted hover:bg-nude active:cursor-grabbing"
              aria-label={`Arrastar ${it.name}`}
            >
              ⠿
            </button>
            <span className="w-6 text-sm text-muted tabular-nums">{i + 1}.</span>
            <span className="flex-1 text-sm font-medium">{it.name}</span>
            <span className="flex gap-1">
              {[
                { d: -1, t: "↑", l: "Subir" },
                { d: 1, t: "↓", l: "Descer" },
              ].map((b) => (
                <button
                  key={b.d}
                  type="button"
                  disabled={saving || i + b.d < 0 || i + b.d >= items.length}
                  onClick={() => {
                    startOrder.current = items.map((x) => x.id);
                    const next = move(i, i + b.d);
                    setItems(next);
                    save(next);
                  }}
                  className="grid size-8 place-items-center rounded-md border border-line-strong text-sm hover:bg-nude disabled:opacity-30"
                  aria-label={`${b.l} ${it.name}`}
                >
                  {b.t}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {status && (
        <p role="status" className="mt-2 text-sm text-muted">
          {status}
        </p>
      )}
    </div>
  );
}
