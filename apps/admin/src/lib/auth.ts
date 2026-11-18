import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { db, schema } from "./db";
import { env } from "./env";
import { recordAudit } from "./audit";
import { sendLoginAlert } from "./login-alert";

const isProd = process.env.NODE_ENV === "production";

/** Caminhos que terminam um login completo (com 2FA). */
const LOGIN_DONE = new Set(["/two-factor/verify-totp", "/two-factor/verify-backup-code", "/sign-in/email"]);

function create() {
  const e = env();
  return betterAuth({
    appName: "Painel da loja",
    baseURL: e.BETTER_AUTH_URL,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [e.BETTER_AUTH_URL],
    database: drizzleAdapter(db(), {
      provider: "pg",
      transaction: true,
      schema: {
        user: schema.adminUsers,
        session: schema.adminSessions,
        account: schema.adminAccounts,
        verification: schema.adminVerifications,
        twoFactor: schema.adminTwoFactors,
        rateLimit: schema.adminRateLimits,
      },
    }),
    user: {
      // Papel definido só pelo script de usuários; não pode ser alterado pela API.
      additionalFields: {
        role: { type: ["dona", "admin"], required: false, defaultValue: "admin", input: false },
        requireTwoFactor: { type: "boolean", required: false, defaultValue: true, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      // Não existe "criar conta": usuários só pelo script `pnpm admin:usuario`.
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    session: {
      expiresIn: 60 * 60 * 12, // 12 h
      updateAge: 60 * 60, // renova a cada 1 h de uso
      freshAge: 60 * 10, // ações sensíveis (trocar senha/2FA) exigem login recente
    },
    rateLimit: {
      enabled: true,
      storage: "database", // várias instâncias na Vercel compartilham o contador
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 15 * 60, max: 5 },
        "/two-factor/verify-totp": { window: 5 * 60, max: 5 },
        "/two-factor/verify-backup-code": { window: 15 * 60, max: 3 },
        "/two-factor/enable": { window: 15 * 60, max: 5 },
        "/change-password": { window: 15 * 60, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: "loja-painel",
      useSecureCookies: isProd,
      defaultCookieAttributes: { sameSite: "strict", httpOnly: true, secure: isProd },
      // Vercel sobrescreve x-real-ip com o IP real (cliente não consegue forjar).
      // Ao colocar o Cloudflare na frente, trocar para ["cf-connecting-ip"].
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        const s = ctx.context.newSession;
        if (!s || !LOGIN_DONE.has(ctx.path)) return;
        // Com 2FA ativo, o login só termina na verificação do código.
        if (ctx.path === "/sign-in/email" && s.user.twoFactorEnabled) return;
        const ip = s.session.ipAddress ?? null;
        await recordAudit({ id: s.user.id, email: s.user.email }, {
          action: "login",
          entity: "conta",
          entityId: s.user.id,
          summary: `Login${ctx.path.includes("backup") ? " com código de recuperação" : ""}`,
          ip,
        });
        await sendLoginAlert({ email: s.user.email, name: s.user.name, ip, userAgent: s.session.userAgent ?? null });
      }),
    },
    plugins: [
      twoFactor({
        issuer: "Painel da loja",
        skipVerificationOnEnable: false,
      }),
      haveIBeenPwned({ customPasswordCompromisedMessage: "Essa senha já apareceu em vazamentos públicos. Escolha outra." }),
      nextCookies(), // deve ser o último
    ],
  });
}

let cached: ReturnType<typeof create> | null = null;

/** Instância criada sob demanda: o build não precisa das variáveis de ambiente. */
export function auth() {
  cached ??= create();
  return cached;
}
