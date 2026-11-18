"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/components/auth-errors";

type Step = "credentials" | "totp" | "backup";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onCredentials(fd: FormData) {
    setError(null);
    setPending(true);
    const { data, error } = await authClient.signIn.email({
      email: String(fd.get("email") ?? "").trim(),
      password: String(fd.get("password") ?? ""),
    });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return setStep("totp");
    // Sem 2FA: o servidor decide (leva à configuração se for obrigatória para esta pessoa).
    router.replace("/");
    router.refresh();
  }

  async function onCode(fd: FormData) {
    setError(null);
    setPending(true);
    const code = String(fd.get("code") ?? "").replace(/\s/g, "");
    const { error } =
      step === "totp" ? await authClient.twoFactor.verifyTotp({ code }) : await authClient.twoFactor.verifyBackupCode({ code });
    setPending(false);
    if (error) return setError(authErrorMessage({ ...error, code: "INVALID_CODE" }));
    router.replace("/");
    router.refresh();
  }

  if (step === "credentials") {
    return (
      <form action={onCredentials} className="space-y-4">
        <h1 className="font-display text-2xl">Entrar</h1>
        <div>
          <label htmlFor="email" className="label">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="username" required className="field" />
        </div>
        <div>
          <label htmlFor="password" className="label">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Entrando…" : "Continuar"}
        </button>
      </form>
    );
  }

  return (
    <form action={onCode} className="space-y-4">
      <h1 className="font-display text-2xl">Verificação</h1>
      <p className="text-sm text-muted">
        {step === "totp"
          ? "Digite o código de 6 dígitos do seu app autenticador."
          : "Digite um dos códigos de recuperação que você guardou. Cada código só funciona uma vez."}
      </p>
      <div>
        <label htmlFor="code" className="label">{step === "totp" ? "Código" : "Código de recuperação"}</label>
        <input
          id="code"
          name="code"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode={step === "totp" ? "numeric" : "text"}
          pattern={step === "totp" ? "[0-9 ]{6,7}" : undefined}
          maxLength={step === "totp" ? 7 : 32}
          className="field text-center font-mono text-lg tracking-[0.4em]"
        />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Verificando…" : "Entrar"}
      </button>
      <button
        type="button"
        className="w-full text-center text-xs text-muted underline-offset-4 hover:text-accent hover:underline"
        onClick={() => {
          setError(null);
          setStep(step === "totp" ? "backup" : "totp");
        }}
      >
        {step === "totp" ? "Perdi o celular — usar código de recuperação" : "Usar o app autenticador"}
      </button>
    </form>
  );
}
