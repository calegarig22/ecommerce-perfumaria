import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Brand } from "@/components/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  const s = await getSession();
  if (s) redirect("/");
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Brand className="mb-8 text-center" />
        <div className="card p-6 sm:p-8">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-muted">Acesso restrito. Tentativas são registradas.</p>
      </div>
    </main>
  );
}
