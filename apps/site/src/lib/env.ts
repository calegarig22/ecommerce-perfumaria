import "server-only";
import { z } from "zod";

const schema = z.object({
  // Connection string do Neon com papel de SOMENTE LEITURA/escrita mínima (ver README).
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => v.startsWith("postgres://") || v.startsWith("postgresql://"), {
      message: "DATABASE_URL precisa ser uma URL postgres",
    })
    .refine((v) => /sslmode=require|sslmode=verify-full/.test(v), {
      message: "DATABASE_URL precisa usar SSL (sslmode=require)",
    })
    .optional(),
});

let parsed: z.infer<typeof schema> | null = null;

export function serverEnv() {
  if (parsed) return parsed;
  const result = schema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL || undefined,
  });
  if (!result.success) {
    // Nunca logar o valor — só o nome da variável e o motivo.
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Variáveis de ambiente inválidas:\n${issues.join("\n")}`);
  }
  parsed = result.data;
  return parsed;
}
