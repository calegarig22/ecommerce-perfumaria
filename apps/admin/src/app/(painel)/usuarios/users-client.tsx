"use client";

import { useActionState, useState } from "react";
import { createUser, removeUser, resetPassword, resetTwoFactor, updateUser, type UserActionState } from "@/lib/actions/users";

type U = { id: string; name: string; email: string; role: "dona" | "admin"; twoFactorEnabled: boolean; requireTwoFactor: boolean; createdAt: string };

/** Senha provisória: aparece uma vez, com botão de copiar. */
function Result({ state }: { state: UserActionState }) {
  const [copied, setCopied] = useState(false);
  if (!state) return null;
  if (!state.ok) return <p role="alert" className="mt-3 text-sm text-danger">{state.message}</p>;
  return (
    <div role="status" className="mt-3 rounded-md bg-ok/10 p-3 text-sm">
      <p className="text-ok">{state.message}</p>
      {state.password && (
        <>
          <p className="mt-2">
            Senha provisória de <strong>{state.email}</strong> (aparece só agora):
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="rounded-sm bg-paper px-2 py-1 font-mono text-base select-all">{state.password}</code>
            <button
              type="button"
              className="btn-secondary py-1"
              onClick={() => navigator.clipboard.writeText(state.password!).then(() => setCopied(true))}
            >
              {copied ? "Copiada ✓" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">Envie por um canal seguro. No primeiro acesso a pessoa troca a senha em Minha conta.</p>
        </>
      )}
    </div>
  );
}

function Fields({ u, idp }: { u?: U; idp: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div>
        <label className="label" htmlFor={`${idp}-name`}>Nome</label>
        <input id={`${idp}-name`} name="name" required maxLength={60} defaultValue={u?.name} className="field" />
      </div>
      <div>
        <label className="label" htmlFor={`${idp}-email`}>E-mail (é o login)</label>
        <input id={`${idp}-email`} name="email" type="email" required maxLength={120} defaultValue={u?.email} className="field" />
      </div>
      <div>
        <label className="label" htmlFor={`${idp}-role`}>Perfil</label>
        <select id={`${idp}-role`} name="role" defaultValue={u?.role ?? "dona"} className="field">
          <option value="dona">Dona (loja: produtos, pedidos)</option>
          <option value="admin">Admin (tudo + gerenciar acessos)</option>
        </select>
      </div>
      <label className="flex items-start gap-2 text-sm md:col-span-3">
        <input type="checkbox" name="requireTwoFactor" defaultChecked={u ? u.requireTwoFactor : true} className="mt-0.5 size-5" />
        <span>
          <strong>Exigir app autenticador (2FA)</strong>
          <span className="block text-xs text-muted">Recomendado. Desmarcado, a pessoa entra só com a senha e pode ativar o 2FA quando quiser.</span>
        </span>
      </label>
    </div>
  );
}

export function NewUser() {
  const [state, action, pending] = useActionState(createUser, null);
  return (
    <form action={action}>
      <Fields idp="novo" />
      <button className="btn-primary mt-4" disabled={pending}>{pending ? "Criando…" : "Criar acesso"}</button>
      <Result state={state} />
    </form>
  );
}

export function UserRow({ u, me }: { u: U; me: boolean }) {
  const [edit, editAction, editing] = useActionState(updateUser.bind(null, u.id), null);
  const [pw, pwAction, pwPending] = useActionState(resetPassword.bind(null, u.id), null);
  const [tf, tfAction, tfPending] = useActionState(resetTwoFactor.bind(null, u.id), null);
  const [rm, rmAction, rmPending] = useActionState(removeUser.bind(null, u.id), null);

  if (rm?.ok) return <li className="card p-4 text-sm text-muted">{rm.message}</li>;

  return (
    <li className="card">
      <details className="group p-4">
        <summary className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">{u.name}</span>
          {me && <span className="badge bg-ink text-paper">você</span>}
          <span className="text-sm text-muted">{u.email}</span>
          <span className="badge bg-nude text-ink">{u.role === "dona" ? "Dona" : "Admin"}</span>
          <span className={`badge ${u.twoFactorEnabled ? "bg-ok/10 text-ok" : u.requireTwoFactor ? "bg-warn/10 text-warn" : "bg-nude text-muted"}`}>
            {u.twoFactorEnabled ? "2FA ativo" : u.requireTwoFactor ? "2FA pendente (1º acesso)" : "só senha"}
          </span>
          <span className="ml-auto text-sm text-accent group-open:hidden">Gerenciar</span>
        </summary>

        <form action={editAction} className="mt-4 border-t border-line pt-4">
          <Fields u={u} idp={`u-${u.id}`} />
          <button className="btn-secondary mt-3" disabled={editing}>{editing ? "Salvando…" : "Salvar"}</button>
          <Result state={edit} />
        </form>

        {!me && (
          <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-3">
            <form action={pwAction}>
              <p className="text-sm font-medium">Esqueceu a senha</p>
              <p className="text-xs text-muted">Gera uma senha provisória nova e encerra as sessões abertas.</p>
              <button className="btn-secondary mt-2" disabled={pwPending}>{pwPending ? "Gerando…" : "Gerar senha nova"}</button>
              <Result state={pw} />
            </form>
            <form action={tfAction}>
              <p className="text-sm font-medium">Perdeu o celular</p>
              <p className="text-xs text-muted">Zera o 2FA; no próximo login configura de novo.</p>
              <button className="btn-secondary mt-2" disabled={tfPending || !u.twoFactorEnabled}>{tfPending ? "Zerando…" : "Zerar 2FA"}</button>
              <Result state={tf} />
            </form>
            <form action={rmAction}>
              <p className="text-sm font-medium text-danger">Remover acesso</p>
              <label className="text-xs text-muted" htmlFor={`rm-${u.id}`}>Digite o e-mail para confirmar</label>
              <input id={`rm-${u.id}`} name="confirm" autoComplete="off" className="field mt-1 py-1.5" />
              <button className="btn-danger mt-2" disabled={rmPending}>{rmPending ? "Removendo…" : "Remover"}</button>
              <Result state={rm} />
            </form>
          </div>
        )}
      </details>
    </li>
  );
}
