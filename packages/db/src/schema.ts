import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const genderEnum = pgEnum("gender", ["feminino", "masculino", "unissex"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

/**
 * Categorias (no código: "linhas"): Perfume, Body Splash, Velas aromáticas,
 * Aromatizadores... A dona cria e edita pelo painel.
 */
export const productLines = pgTable(
  "product_lines",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    skuPrefix: text("sku_prefix").notNull().unique(),
    description: text("description").notNull(),
    /** Unidade padrão dos tamanhos desta categoria: ml, g ou un (ver src/units.ts). */
    unit: text("unit").notNull().default("ml"),
    /** false = categoria escondida do site (os produtos dela também somem). */
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [check("product_lines_unit", sql`${t.unit} IN ('ml', 'g', 'un')`)],
);

/**
 * O item base (no código: "fragrância"): o cheiro ou modelo, independente da categoria
 * em que é vendido. Família e notas são opcionais (ex.: kit presente, acessório).
 */
export const fragrances = pgTable(
  "fragrances",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    /** Vazio = sem família olfativa (ex.: acessório). */
    family: text("family").notNull().default(""),
    /** null = não se aplica (produtos para casa, acessórios). */
    gender: genderEnum("gender"),
    notesTop: text("notes_top").array().notNull().default(sql`'{}'::text[]`),
    notesHeart: text("notes_heart").array().notNull().default(sql`'{}'::text[]`),
    notesBase: text("notes_base").array().notNull().default(sql`'{}'::text[]`),
    description: text("description"),
    /** USO INTERNO — referência olfativa do catálogo impresso. Nunca expor no site. */
    internalReference: text("internal_reference"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("fragrances_family_idx").on(t.family)],
);

/** Produto vendável = fragrância × linha (ex.: Aurora Body Splash). */
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    fragranceId: integer("fragrance_id")
      .notNull()
      .references(() => fragrances.id, { onDelete: "restrict" }),
    lineId: integer("line_id")
      .notNull()
      .references(() => productLines.id, { onDelete: "restrict" }),
    featured: boolean("featured").notNull().default(false),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("products_fragrance_line_uq").on(t.fragranceId, t.lineId)],
);

/** Variação com SKU, tamanho, preço e estoque. */
export const productVariants = pgTable(
  "product_variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    /** Tamanho na unidade `unit` (coluna antiga volume_ml: hoje vale para ml, g ou un). */
    size: integer("volume_ml"),
    unit: text("unit").notNull().default("ml"),
    /** Rótulo opcional mostrado ao cliente (ex.: "Refil", "Kit com 3"). */
    label: text("label"),
    /** Centavos. null = preço sob consulta. */
    priceCents: integer("price_cents"),
    /** null = estoque não controlado (produção sob encomenda); número = unidades disponíveis. */
    stock: integer("stock"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("variants_product_idx").on(t.productId),
    check("variants_price_nonneg", sql`${t.priceCents} IS NULL OR ${t.priceCents} >= 0`),
    check("variants_stock_nonneg", sql`${t.stock} IS NULL OR ${t.stock} >= 0`),
    check("variants_unit", sql`${t.unit} IN ('ml', 'g', 'un')`),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull(),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("images_product_idx").on(t.productId)],
);

/* ───────────────────────────── Painel admin ─────────────────────────────
 * Tabelas da autenticação (Better Auth). Os nomes das propriedades seguem o
 * que a biblioteca espera (camelCase); as colunas ficam em snake_case.
 * O papel do site (loja_site) NÃO tem acesso a nenhuma delas.
 */

export const adminRoleEnum = pgEnum("admin_role", ["dona", "admin"]);

export const adminUsers = pgTable("admin_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  /** "dona" = gestão da loja; "admin" = suporte técnico. Mesmo acesso ao catálogo e pedidos. */
  role: adminRoleEnum("role").notNull().default("admin"),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  /** true = obrigado a configurar o app autenticador (2FA); false = 2FA opcional (ativa se quiser). */
  requireTwoFactor: boolean("require_two_factor").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const adminSessions = pgTable(
  "admin_session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("admin_session_user_idx").on(t.userId)],
);

export const adminAccounts = pgTable(
  "admin_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    /** Hash da senha (scrypt), nunca a senha. */
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("admin_account_user_idx").on(t.userId)],
);

export const adminVerifications = pgTable(
  "admin_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("admin_verification_identifier_idx").on(t.identifier)],
);

export const adminTwoFactors = pgTable(
  "admin_two_factor",
  {
    id: text("id").primaryKey(),
    /** Segredo TOTP, criptografado pela biblioteca. */
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (t) => [index("admin_two_factor_user_idx").on(t.userId), index("admin_two_factor_secret_idx").on(t.secret)],
);

/** Limite de tentativas (login, 2FA) — no banco porque a Vercel roda várias instâncias. */
export const adminRateLimits = pgTable("admin_rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/** Registro de quem alterou o quê no painel. Só INSERT/SELECT para o painel: ninguém apaga. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => adminUsers.id, { onDelete: "set null" }),
    userEmail: text("user_email").notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    changes: jsonb("changes"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt), index("audit_log_entity_idx").on(t.entity, t.entityId)],
);

/* ──────────────────────────────── Pedidos ────────────────────────────────
 * Prontos para o checkout (fase 2), independentes do intermediário
 * (Mercado Pago, Pagar.me, PagBank, Asaas...). Ver src/orders.ts.
 */

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment", // pedido criado, aguardando PIX/cartão
  "paid", // pagamento confirmado pelo intermediário (webhook)
  "preparing", // em separação
  "shipped", // enviado / pronto para retirada
  "delivered",
  "canceled",
  "expired", // PIX/boleto não pago no prazo
  "refunded",
]);

export const paymentMethodEnum = pgEnum("payment_method", ["pix", "credit_card", "debit_card", "boleto", "whatsapp"]);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    /** Código mostrado ao cliente (ex.: PED-7K2Q9M). Não sequencial, para não revelar volume de vendas. */
    code: text("code").notNull().unique(),
    status: orderStatusEnum("status").notNull().default("pending_payment"),

    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    /** CPF — dado pessoal (LGPD). Exigido pela maioria dos intermediários. */
    customerDocument: text("customer_document"),
    /** { cep, street, number, complement, district, city, state } */
    shippingAddress: jsonb("shipping_address"),
    shippingMethod: text("shipping_method"),

    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),

    paymentProvider: text("payment_provider"),
    paymentMethod: paymentMethodEnum("payment_method"),
    /** Id do checkout/cobrança no intermediário (preference, charge, order...). */
    providerReference: text("provider_reference"),
    /** Id do pagamento aprovado no intermediário. */
    providerPaymentId: text("provider_payment_id"),
    installments: integer("installments"),

    paidAt: timestamp("paid_at", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    trackingCode: text("tracking_code"),
    /** Observação interna da loja (não aparece para o cliente). */
    internalNotes: text("internal_notes"),
    ...timestamps,
  },
  (t) => [
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
    uniqueIndex("orders_provider_ref_uq").on(t.paymentProvider, t.providerReference),
    check("orders_amounts_nonneg", sql`${t.subtotalCents} >= 0 AND ${t.shippingCents} >= 0 AND ${t.discountCents} >= 0`),
    check("orders_total_consistent", sql`${t.totalCents} = ${t.subtotalCents} + ${t.shippingCents} - ${t.discountCents}`),
  ],
);

/** Itens com "foto" do produto no momento da compra: mudar o catálogo depois não altera pedidos antigos. */
export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    sku: text("sku").notNull(),
    productName: text("product_name").notNull(),
    lineName: text("line_name").notNull(),
    size: integer("volume_ml"),
    unit: text("unit"),
    label: text("label"),
    unitPriceCents: integer("unit_price_cents").notNull(),
    qty: integer("qty").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    check("order_items_qty_pos", sql`${t.qty} > 0`),
    check("order_items_price_nonneg", sql`${t.unitPriceCents} >= 0`),
  ],
);

/**
 * Notificações (webhooks) recebidas do intermediário. A combinação
 * provider + event_id é única: o mesmo aviso chegando duas vezes não
 * confirma o pedido duas vezes nem baixa estoque em dobro.
 */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [uniqueIndex("payment_events_provider_event_uq").on(t.provider, t.eventId), index("payment_events_order_idx").on(t.orderId)],
);
