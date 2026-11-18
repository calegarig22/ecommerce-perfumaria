import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MANUAL_TRANSITIONS, ORDER_STATUS_LABEL } from "@perfumaria/db/orders";
import { getOrder } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { formatDateTime, formatPrice, formatSize } from "@/lib/format";
import { updateOrder } from "@/lib/actions/orders";
import { PageHeader } from "@/components/page-header";
import { ActionForm } from "@/components/action-form";
import { OrderStatusBadge } from "@/components/order-status";

export const metadata: Metadata = { title: "Pedido" };

const METHOD: Record<string, string> = { pix: "PIX", credit_card: "Cartão de crédito", debit_card: "Cartão de débito", boleto: "Boleto", whatsapp: "WhatsApp" };

export default async function OrderPage({ params }: PageProps<"/pedidos/[code]">) {
  await requireUser();
  const { code } = await params;
  if (!/^PED-[A-Z0-9]{6}$/.test(code)) notFound();
  const data = await getOrder(code);
  if (!data) notFound();
  const { order: o, items } = data;
  const addr = (o.shippingAddress ?? null) as Record<string, string> | null;
  const next = MANUAL_TRANSITIONS[o.status];

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/pedidos" className="text-accent hover:underline">← Pedidos</Link></p>
      <PageHeader title={`Pedido ${o.code}`} subtitle={<>Feito em {formatDateTime(o.createdAt)} · <OrderStatusBadge status={o.status} /></>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2">
          <h2 className="font-display text-xl">Itens</h2>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-line">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="py-2">{i.qty}×</td>
                  <td className="py-2">{i.productName} <span className="text-muted">· {i.lineName}{formatSize(i.size, i.unit, i.label) ? ` ${formatSize(i.size, i.unit, i.label)}` : ""}</span><span className="block font-mono text-xs text-muted">{i.sku}</span></td>
                  <td className="py-2 text-right">{formatPrice(i.unitPriceCents * i.qty)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line-strong">
              <tr><td /><td className="pt-2 text-muted">Subtotal</td><td className="pt-2 text-right">{formatPrice(o.subtotalCents)}</td></tr>
              <tr><td /><td className="text-muted">Frete {o.shippingMethod ? `(${o.shippingMethod})` : ""}</td><td className="text-right">{formatPrice(o.shippingCents)}</td></tr>
              {o.discountCents > 0 && <tr><td /><td className="text-muted">Desconto</td><td className="text-right">−{formatPrice(o.discountCents)}</td></tr>}
              <tr><td /><td className="pt-1 font-medium">Total</td><td className="pt-1 text-right font-medium">{formatPrice(o.totalCents)}</td></tr>
            </tfoot>
          </table>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted">Pagamento</dt>
            <dd>{o.paymentMethod ? METHOD[o.paymentMethod] : "—"}{o.installments && o.installments > 1 ? ` em ${o.installments}x` : ""}{o.paymentProvider ? ` · ${o.paymentProvider}` : ""}</dd>
            <dt className="text-muted">Pago em</dt>
            <dd>{o.paidAt ? formatDateTime(o.paidAt) : "—"}</dd>
            {o.providerPaymentId && (<><dt className="text-muted">Id no intermediário</dt><dd className="font-mono text-xs">{o.providerPaymentId}</dd></>)}
          </dl>
        </section>
        <section className="card p-5">
          <h2 className="font-display text-xl">Cliente</h2>
          <p className="mt-3 text-sm">{o.customerName}<br />{o.customerEmail}{o.customerPhone && <><br />{o.customerPhone}</>}</p>
          {addr && (
            <p className="mt-3 text-sm">
              {addr.street}, {addr.number}{addr.complement ? ` — ${addr.complement}` : ""}<br />
              {addr.district} · {addr.city}/{addr.state}<br />CEP {addr.cep}
            </p>
          )}
        </section>
        <section className="card p-5 xl:col-span-3">
          <h2 className="font-display text-xl">Andamento</h2>
          <ActionForm action={updateOrder.bind(null, o.code)} submitLabel="Salvar">
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className="label" htmlFor="status">Situação</label>
                <select id="status" name="status" defaultValue={o.status} className="field">
                  <option value={o.status}>{ORDER_STATUS_LABEL[o.status]} (atual)</option>
                  {next.map((st) => <option key={st} value={st}>{ORDER_STATUS_LABEL[st]}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted">“Pago” só é marcado automaticamente pelo intermediário de pagamento.</p>
              </div>
              <div>
                <label className="label" htmlFor="trackingCode">Código de rastreio</label>
                <input id="trackingCode" name="trackingCode" maxLength={60} defaultValue={o.trackingCode ?? ""} className="field" />
              </div>
              <div>
                <label className="label" htmlFor="internalNotes">Observação interna</label>
                <textarea id="internalNotes" name="internalNotes" rows={2} maxLength={2000} defaultValue={o.internalNotes ?? ""} className="field" />
              </div>
            </div>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
