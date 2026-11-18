import type { Metadata } from "next";
import Link from "next/link";
import { ORDER_STATUSES, ORDER_STATUS_LABEL } from "@perfumaria/db/orders";
import { listOrders } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { formatDateTime, formatPrice } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { OrderStatusBadge } from "@/components/order-status";

export const metadata: Metadata = { title: "Pedidos" };

export default async function OrdersPage({ searchParams }: PageProps<"/pedidos">) {
  await requireUser();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const orders = await listOrders(status);
  return (
    <>
      <PageHeader title="Pedidos" subtitle="Pedidos feitos pelo checkout do site." />
      <nav className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Filtrar por situação">
        <Link href="/pedidos" className={`badge px-2.5 py-1 ${!status ? "bg-ink text-paper" : "bg-paper text-ink border border-line"}`}>Todos</Link>
        {ORDER_STATUSES.map((st) => (
          <Link key={st} href={`/pedidos?status=${st}`} className={`badge px-2.5 py-1 ${status === st ? "bg-ink text-paper" : "bg-paper text-ink border border-line"}`}>
            {ORDER_STATUS_LABEL[st]}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <div className="card p-6 text-sm text-muted">
          <p>Nenhum pedido {status ? "nesta situação" : "ainda"}.</p>
          <p className="mt-1">Os pedidos aparecem aqui quando o pagamento pelo site (PIX/cartão) for ativado. Hoje os pedidos chegam pelo WhatsApp.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Pedido</th>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2 font-mono">
                    <Link href={`/pedidos/${o.code}`} className="text-ink hover:text-accent hover:underline">{o.code}</Link>
                  </td>
                  <td className="px-4 py-2">{formatDateTime(o.createdAt)}</td>
                  <td className="px-4 py-2">{o.customerName}</td>
                  <td className="px-4 py-2">{formatPrice(o.totalCents)}</td>
                  <td className="px-4 py-2"><OrderStatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
