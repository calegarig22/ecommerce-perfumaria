/**
 * Contrato do intermediário de pagamento (fase 2 — checkout no site).
 *
 * O site fala só com esta interface. Trocar Mercado Pago por Pagar.me, PagBank
 * ou Asaas = escrever um novo adaptador, sem mexer em carrinho, pedidos ou painel.
 *
 * Regras de segurança que todo adaptador deve seguir:
 *  1. Dados de cartão NUNCA passam pelo nosso servidor: checkout hospedado
 *     (redirecionamento) ou componente/tokenização do próprio intermediário.
 *  2. Valor cobrado vem do pedido salvo no banco (recalculado no servidor),
 *     nunca do navegador.
 *  3. Pedido só vira "pago" por webhook com assinatura verificada E consulta
 *     de confirmação na API do intermediário (não confiar só no corpo do aviso).
 *  4. Webhook idempotente: tabela payment_events (provider + event_id únicos).
 */

export type PaymentMethod = "pix" | "credit_card" | "debit_card" | "boleto";

export type CheckoutItem = {
  sku: string;
  title: string;
  unitPriceCents: number;
  qty: number;
};

export type CreateCheckoutInput = {
  orderCode: string;
  items: CheckoutItem[];
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  customer: { name: string; email: string; phone?: string; document?: string };
  methods: PaymentMethod[];
  /** Para onde o cliente volta depois de pagar / desistir. */
  returnUrl: string;
  /** Endpoint de webhook do site. */
  notificationUrl: string;
  /** Prazo para pagar (PIX). */
  expiresAt: Date;
};

export type CreateCheckoutResult = {
  /** Id do checkout/cobrança no intermediário → orders.provider_reference */
  reference: string;
  /** URL do checkout hospedado (redirecionamento). */
  redirectUrl?: string;
  /** Dados do PIX, quando o intermediário devolve direto (QR na própria página). */
  pix?: { qrCode: string; qrCodeBase64?: string; expiresAt: Date };
};

export type PaymentStatus = "pending" | "approved" | "rejected" | "canceled" | "expired" | "refunded" | "in_process";

export type VerifiedPayment = {
  reference: string;
  paymentId: string;
  orderCode: string;
  status: PaymentStatus;
  method: PaymentMethod | null;
  amountCents: number;
  installments: number | null;
};

export type WebhookEvent = { eventId: string; type: string; payload: unknown };

export interface PaymentProvider {
  readonly id: "mercadopago" | "pagarme" | "pagbank" | "asaas" | "stripe";
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  /** Valida a assinatura do webhook. Lança erro se inválida. */
  verifyWebhook(request: Request, rawBody: string): Promise<WebhookEvent>;
  /** Consulta a API do intermediário para confirmar o pagamento (fonte da verdade). */
  fetchPayment(event: WebhookEvent): Promise<VerifiedPayment | null>;
}
