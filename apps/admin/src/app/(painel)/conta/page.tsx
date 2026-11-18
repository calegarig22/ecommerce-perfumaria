import type { Metadata } from "next";
import { and, desc, eq, gt } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { FRESH_LOGIN_MESSAGE } from "@/components/auth-errors";
import { formatDateTime } from "@/lib/format";
import { revokeOtherSessions } from "@/lib/actions/account";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/confirm-button";
import Link from "next/link";
import { ChangePassword, BackupCodes, DisableTwoFactor } from "./security-forms";

export const metadata: Metadata = { title: "Minha conta" };

function device(ua: string | null | undefined) {
  if (!ua) return "Dispositivo desconhecido";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Outro";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return `${br} · ${os}`;
}

export default async function AccountPage({ searchParams }: PageProps<"/conta">) {
  const user = await requireUser();
  const sp = await searchParams;
  // Lê direto do banco (só as sessões da própria pessoa): listSessions da biblioteca exige login recente
  // e derrubava a página para quem entrou há mais de 10 minutos.
  const sessions = await db()
    .select({ id: s.adminSessions.id, userAgent: s.adminSessions.userAgent, ipAddress: s.adminSessions.ipAddress, createdAt: s.adminSessions.createdAt })
    .from(s.adminSessions)
    .where(and(eq(s.adminSessions.userId, user.id), gt(s.adminSessions.expiresAt, new Date())))
    .orderBy(desc(s.adminSessions.createdAt));
  return (
    <>
      <PageHeader title="Minha conta" subtitle={`${user.name} · ${user.email}`} />
      {sp.erro === "login-recente" && (
        <p role="alert" className="mb-6 rounded-md bg-caramel/15 p-3 text-sm">{FRESH_LOGIN_MESSAGE}</p>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-display text-xl">Trocar senha</h2>
          <p className="mt-1 text-xs text-muted">Mínimo de 12 caracteres. Uma frase longa é mais fácil de lembrar e mais segura.</p>
          <ChangePassword />
        </section>
        <section className="card p-5">
          <h2 className="font-display text-xl">Verificação em duas etapas</h2>
          {user.twoFactorEnabled ? (
            <>
              <p className="mt-2 text-sm"><span className="badge bg-ok/10 text-ok">Ativa</span> O login sempre pede o código do app autenticador.</p>
              <BackupCodes />
              {!user.requireTwoFactor && <DisableTwoFactor />}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm">
                <span className="badge bg-nude text-muted">Desligada</span> O login pede só a senha. Recomendado ativar: protege o painel se a senha vazar.
              </p>
              <Link href="/configurar-2fa" className="btn-primary mt-3">Ativar agora</Link>
            </>
          )}
        </section>
        <section className="card p-5 xl:col-span-2">
          <h2 className="font-display text-xl">Sessões abertas</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {device(s.userAgent)} {s.id === user.session.id && <span className="badge ml-1 bg-ink text-paper">esta</span>}
                </span>
                <span className="text-xs text-muted">IP {s.ipAddress ?? "—"} · desde {formatDateTime(s.createdAt)}</span>
              </li>
            ))}
          </ul>
          {sessions.length > 1 && (
            <form action={revokeOtherSessions} className="mt-3">
              <ConfirmButton message="Encerrar todas as outras sessões?" className="btn-danger">Encerrar as outras sessões</ConfirmButton>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
