import Link from "next/link";
import { dashboardStats } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { AuditList } from "@/components/audit-list";

const SHORTCUTS = [
  { href: "/produtos/novo", title: "+ Novo produto", text: "Um, vários ou só fotos", primary: true },
  { href: "/produtos", title: "Preços e estoque", text: "Ajuste rápido na lista" },
];

export default async function Home() {
  const user = await requireUser();
  const st = await dashboardStats();

  // Pendências em ordem de importância para a venda.
  const todo = [
    st.ordersToHandle > 0 && { n: st.ordersToHandle, text: "pedido(s) pago(s) para separar", href: "/pedidos?status=paid", action: "Ver pedidos", tone: "danger" },
    st.lowStock > 0 && { n: st.lowStock, text: "produto(s) acabando ou esgotados", href: "/produtos?status=estoque-baixo", action: "Repor estoque", tone: "warn" },
    st.noPhoto > 0 && { n: st.noPhoto, text: "produto(s) sem foto no site", href: "/produtos/novo?modo=fotos", action: "Enviar fotos", tone: "warn" },
    st.noPrice > 0 && { n: st.noPrice, text: "produto(s) sem preço (aparecem como “sob consulta”)", href: "/produtos?status=sem-preco", action: "Colocar preço", tone: "warn" },
    st.hidden > 0 && { n: st.hidden, text: "produto(s) escondido(s) do site", href: "/produtos?status=inativos", action: "Revisar", tone: "muted" },
  ].filter(Boolean) as { n: number; text: string; href: string; action: string; tone: string }[];

  return (
    <>
      <PageHeader title={`Olá, ${user.name.split(" ")[0]}`} subtitle={`${st.products} produto(s) à venda no site.`} />

      <section aria-labelledby="atalhos" className="mb-10">
        <h2 id="atalhos" className="sr-only">Atalhos</h2>
        <ul className="grid grid-cols-2 gap-3 lg:max-w-2xl">
          {SHORTCUTS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className={`block h-full rounded-md border p-4 transition-colors ${
                  s.primary ? "border-ink bg-ink text-paper hover:bg-accent-deep" : "card hover:border-accent"
                }`}
              >
                <span className="block font-display text-lg leading-tight">{s.title}</span>
                <span className={`mt-1 block text-xs ${s.primary ? "text-paper/75" : "text-muted"}`}>{s.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pendencias" className="mb-10">
        <h2 id="pendencias" className="mb-3 font-display text-xl">O que fazer agora</h2>
        {todo.length ? (
          <ul className="card divide-y divide-line">
            {todo.map((t) => (
              <li key={t.href} className="flex flex-wrap items-center gap-3 p-4">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full font-display text-lg ${
                    t.tone === "danger" ? "bg-danger/10 text-danger" : t.tone === "warn" ? "bg-warn/10 text-warn" : "bg-nude text-muted"
                  }`}
                >
                  {t.n}
                </span>
                <span className="min-w-0 flex-1 text-sm">{t.text}</span>
                <Link href={t.href} className="btn-secondary">{t.action}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card p-4 text-sm text-ok">Tudo em dia: produtos com foto, preço e estoque. ✨</p>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl">Últimas alterações</h2>
          <Link href="/historico" className="text-sm text-accent hover:underline">Ver tudo</Link>
        </div>
        <AuditList entries={st.recent} />
      </section>
    </>
  );
}
