"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/components/auth-errors";

type State =
  | { step: "password" }
  | { step: "scan"; qr: string; secret: string; backupCodes: string[] }
  | { step: "codes"; backupCodes: string[] };

export function TwoFactorSetup() {
  const router = useRouter();
  const [state, setState] = useState<State>({ step: "password" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onPassword(fd: FormData) {
    setError(null);
    setPending(true);
    const { data, error } = await authClient.twoFactor.enable({ password: String(fd.get("password") ?? ""), method: "totp" });
    if (error || !data || data.method !== "totp") {
      setPending(false);
      return setError(error?.status === 429 ? authErrorMessage(error) : "Senha incorreta.");
    }
    const qr = await QRCode.toDataURL(data.totpURI, { margin: 1, width: 192, errorCorrectionLevel: "M" });
    const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
    setPending(false);
    setState({ step: "scan", qr, secret, backupCodes: data.backupCodes });
  }

  async function onVerify(fd: FormData) {
    if (state.step !== "scan") return;
    setError(null);
    setPending(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code: String(fd.get("code") ?? "").replace(/\s/g, "") });
    setPending(false);
    if (error) return setError(authErrorMessage({ ...error, code: "INVALID_CODE" }));
    setState({ step: "codes", backupCodes: state.backupCodes });
  }

  if (state.step === "password") {
    return (
      <form action={onPassword} className="mt-6 space-y-4">
        <div>
          <label htmlFor="password" className="label">Confirme sua senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Preparando…" : "Começar"}
        </button>
      </form>
    );
  }

  if (state.step === "scan") {
    return (
      <form action={onVerify} className="mt-6 space-y-5">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Instale um app autenticador (Google Authenticator, Microsoft Authenticator ou o app Senhas do iPhone).</li>
          <li>No app, toque em adicionar e aponte a câmera para o código abaixo.</li>
          <li>Digite o código de 6 dígitos que aparecer.</li>
        </ol>
        {/* QR gerado no próprio navegador — o segredo não passa por serviço externo. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={state.qr} alt="QR code para o app autenticador" width={192} height={192} className="mx-auto rounded-md border border-line bg-paper p-2" />
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Não consigo ler o QR code</summary>
          <p className="mt-2">Digite esta chave no app (tipo: baseada em tempo):</p>
          <code className="mt-1 block rounded-sm bg-nude p-2 font-mono text-sm break-all text-ink select-all">{state.secret}</code>
        </details>
        <div>
          <label htmlFor="code" className="label">Código do app</label>
          <input
            id="code"
            name="code"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            className="field text-center font-mono text-lg tracking-[0.4em]"
          />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Verificando…" : "Ativar"}
        </button>
      </form>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="rounded-md bg-nude p-3 text-sm">
        <strong>Verificação em duas etapas ativada.</strong> Guarde os códigos de recuperação abaixo num lugar seguro
        (anote no papel ou salve no gerenciador de senhas). Eles servem para entrar se você perder o celular — cada um
        funciona uma única vez. <strong>Eles não serão mostrados de novo.</strong>
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-md border border-line p-3 font-mono text-sm select-all">
        {state.backupCodes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-1" />
        Guardei os códigos de recuperação.
      </label>
      <button
        type="button"
        disabled={!saved}
        className="btn-primary w-full"
        onClick={() => {
          router.replace("/");
          router.refresh();
        }}
      >
        Ir para o painel
      </button>
    </div>
  );
}
