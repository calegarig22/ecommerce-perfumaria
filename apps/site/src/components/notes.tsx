import type { Notes } from "@/lib/types";
import { strata } from "@/lib/format";

const tiers = [
  { key: "top", name: "Saída", hint: "o que se sente primeiro" },
  { key: "heart", name: "Coração", hint: "a alma da fragrância" },
  { key: "base", name: "Fundo", hint: "o que fica na pele" },
] as const;

/**
 * Pirâmide olfativa como camadas — mesma ordem e cores do líquido no frasco.
 * Camadas sem notas cadastradas são omitidas.
 */
export function NotesPyramid({ notes, family, compact = false }: { notes: Notes; family: string; compact?: boolean }) {
  const c = strata(family);
  const present = tiers.filter((t) => notes[t.key].length > 0);
  if (!present.length) return null;

  return (
    <dl className="divide-y divide-line border-y border-line">
      {present.map((t) => (
        <div key={t.key} className={compact ? "py-3" : "py-4 sm:grid sm:grid-cols-[9rem_1fr] sm:gap-x-4 sm:py-5"}>
          <dt className="flex items-start gap-3">
            <span aria-hidden className="mt-1.5 block h-3.5 w-1.5 rounded-sm" style={{ background: c[t.key] }} />
            <span>
              <span className="block text-sm font-medium">{t.name}</span>
              {!compact && <span className="hidden text-xs text-muted sm:block">{t.hint}</span>}
            </span>
          </dt>
          <dd className={compact ? "mt-1 pl-[1.125rem] text-sm leading-relaxed text-ink/85" : "mt-1 pl-[1.125rem] leading-relaxed text-ink/85 sm:mt-0 sm:pl-0"}>
            {notes[t.key].join(", ")}
          </dd>
        </div>
      ))}
    </dl>
  );
}
