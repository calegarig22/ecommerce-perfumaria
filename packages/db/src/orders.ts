/**
 * Regras de pedido compartilhadas entre site (checkout) e painel.
 * Sem dependência de banco nem de intermediário de pagamento.
 */
import { randomInt } from "node:crypto";

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "canceled",
  "expired",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Aguardando pagamento",
  paid: "Pago",
  preparing: "Em separação",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
  expired: "Expirado",
  refunded: "Reembolsado",
};

/**
 * Mudanças de status permitidas.
 * "paid", "expired" e "refunded" chegam pelo intermediário (webhook), não à mão:
 * o painel nunca marca um pedido como pago sem confirmação do pagamento.
 */
export const MANUAL_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["canceled"],
  paid: ["preparing", "canceled"],
  preparing: ["shipped", "canceled"],
  shipped: ["delivered"],
  delivered: [],
  canceled: [],
  expired: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return MANUAL_TRANSITIONS[from].includes(to);
}

/** Sem 0/O/1/I/L para não confundir quem lê o código em voz alta. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Código público do pedido, ex.: PED-7K2Q9M. Aleatório (não revela quantas vendas houve). */
export function newOrderCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `PED-${s}`;
}
