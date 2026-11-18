import "server-only";
import { z } from "zod";

const pgUrl = z
  .string()
  .url()
  .refine((v) => /^postgres(ql)?:\/\//.test(v), "precisa ser uma URL postgres")
  .refine((v) => /sslmode=(require|verify-full)/.test(v), "precisa usar SSL (sslmode=require)")
  .refine((v) => new URL(v).username === "loja_admin", "o painel deve usar o papel loja_admin");

const schema = z.object({
  DATABASE_URL: pgUrl,
  BETTER_AUTH_SECRET: z.string().min(32, "mínimo 32 caracteres"),
  BETTER_AUTH_URL: z.string().url(),
  SITE_URL: z.string().url(),
  REVALIDATE_SECRET: z.string().min(32, "mínimo 32 caracteres"),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  LOGIN_ALERT_FROM: z.string().optional(),
});

let parsed: z.infer<typeof schema> | null = null;

/** Valida as variáveis na primeira chamada. Nunca loga valores — só nomes e motivos. */
export function env() {
  if (parsed) return parsed;
  const raw = Object.fromEntries(Object.keys(schema.shape).map((k) => [k, process.env[k] || undefined]));
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Variáveis de ambiente do painel inválidas:\n${issues.join("\n")}`);
  }
  parsed = result.data;
  return parsed;
}
