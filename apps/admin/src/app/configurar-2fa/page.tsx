import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { Brand } from "@/components/brand";
import { TwoFactorSetup } from "./setup";

export const metadata: Metadata = { title: "Proteger a conta" };

export default async function Setup2faPage() {
  const user = await requireUser({ allowWithout2fa: true });
  if (user.twoFactorEnabled) redirect("/");
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <Brand className="mb-8 text-center" />
        <div className="card p-6 sm:p-8">
          <h1 className="font-display text-2xl">Proteja sua conta</h1>
          <p className="mt-2 text-sm text-muted">
            Olá, {user.name}. {user.requireTwoFactor ? "Para usar o painel, ative" : "Recomendado: ative"} a verificação em duas etapas.
            Depois disso, além da senha, o login pede um código que muda a cada 30 segundos no seu celular.
          </p>
          <TwoFactorSetup />
          {!user.requireTwoFactor && (
            <p className="mt-4 text-center text-sm">
              <Link href="/" className="text-muted hover:underline">Agora não</Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
