"use client";

import { useRouter } from "next/navigation";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/components/auth-errors";
import { logBackupCodesRegenerated, logPasswordChanged, logTwoFactorDisabled } from "@/lib/actions/account";

export function ChangePassword() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(fd: FormData) {
    setMsg(null);
    const next = String(fd.get("new") ?? "");
    if (next !== String(fd.get("confirm") ?? "")) return setMsg({ ok: false, text: "A confirmação não confere." });
    if (next.length < 12) return setMsg({ ok: false, text: "A nova senha precisa ter pelo menos 12 caracteres." });
    setPending(true);
    const { error } = await authClient.changePassword({
      currentPassword: String(fd.get("current") ?? ""),
      newPassword: next,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (error) {
      const text = error.status === 400 && !/vazamentos/.test(error.message ?? "") ? "Senha atual incorreta ou nova senha fraca." : authErrorMessage(error);
      return setMsg({ ok: false, text });
    }
    await logPasswordChanged();
    setMsg({ ok: true, text: "Senha trocada. As outras sessões foram encerradas." });
  }

  return (
    <form action={onSubmit} className="mt-4 space-y-3">
      <div>
        <label className="label" htmlFor="current">Senha atual</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="new">Nova senha</label>
        <input id="new" name="new" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Repita a nova senha</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="field" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "Trocando…" : "Trocar senha"}</button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}

export function BackupCodes() {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(fd: FormData) {
    setError(null);
    setPending(true);
    const { data, error } = await authClient.twoFactor.generateBackupCodes({ password: String(fd.get("password") ?? "") });
    setPending(false);
    if (error || !data)
      return setError(error?.status === 429 || error?.code === "SESSION_NOT_FRESH" ? authErrorMessage(error) : "Senha incorreta.");
    await logBackupCodesRegenerated();
    setCodes(data.backupCodes);
  }

  if (codes) {
    return (
      <div className="mt-4 space-y-2">
        <p className="text-sm"><strong>Novos códigos de recuperação.</strong> Os antigos deixaram de funcionar. Guarde estes agora — não serão mostrados de novo.</p>
        <ul className="grid grid-cols-2 gap-2 rounded-md border border-line p-3 font-mono text-sm select-all">
          {codes.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-accent">Gerar novos códigos de recuperação</summary>
      <form action={onSubmit} className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="bc-password">Confirme sua senha</label>
          <input id="bc-password" name="password" type="password" autoComplete="current-password" required className="field" />
        </div>
        <button disabled={pending} className="btn-secondary">{pending ? "Gerando…" : "Gerar"}</button>
        {error && <p role="alert" className="w-full text-danger">{error}</p>}
      </form>
    </details>
  );
}

/** 2FA opcional (definido pelo Admin): a própria pessoa pode desligar, confirmando a senha. */
export function DisableTwoFactor() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function onSubmit(fd: FormData) {
    if (!window.confirm("Desligar o código do celular? O login vai pedir só a senha.")) return;
    setPending(true);
    setError(null);
    const { error } = await authClient.twoFactor.disable({ password: String(fd.get("password") ?? "") });
    setPending(false);
    if (error) return setError(error.status === 429 || error.code === "SESSION_NOT_FRESH" ? authErrorMessage(error) : "Senha incorreta.");
    await logTwoFactorDisabled();
    router.refresh();
  }
  return (
    <form action={onSubmit} className="mt-3 flex flex-wrap items-end gap-2 text-sm">
      <div>
        <label className="label" htmlFor="disable-2fa-password">Senha</label>
        <input id="disable-2fa-password" name="password" type="password" required autoComplete="current-password" className="field w-56" />
      </div>
      <button type="submit" disabled={pending} className="btn-secondary">{pending ? "Desligando…" : "Desligar 2FA"}</button>
      {error && <p role="alert" className="w-full text-danger">{error}</p>}
    </form>
  );
}
