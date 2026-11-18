import { formatDateTime } from "@/lib/format";

type Entry = {
  id: number;
  userEmail: string;
  action: string;
  entity: string;
  summary: string;
  changes: unknown;
  ip: string | null;
  createdAt: Date;
};

export function AuditList({ entries }: { entries: Entry[] }) {
  if (!entries.length) return <p className="card p-4 text-sm text-muted">Nenhuma alteração registrada ainda.</p>;
  return (
    <ol className="card divide-y divide-line">
      {entries.map((e) => {
        const changes = (e.changes ?? {}) as Record<string, { de: unknown; para: unknown }>;
        const keys = Object.keys(changes);
        return (
          <li key={e.id} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <p>
                <span className="badge mr-2 bg-nude text-accent-deep">{e.action}</span>
                {e.summary}
              </p>
              <p className="text-xs text-muted">
                {formatDateTime(e.createdAt)} · {e.userEmail}
                {e.ip ? ` · ${e.ip}` : ""}
              </p>
            </div>
            {keys.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
                {keys.slice(0, 12).map((k) => (
                  <li key={k}>
                    <span className="text-ink">{k}:</span> {show(changes[k].de)} → {show(changes[k].para)}
                  </li>
                ))}
                {keys.length > 12 && <li>… e mais {keys.length - 12}</li>}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function show(v: unknown) {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (Array.isArray(v)) return v.join(", ") || "—";
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}
