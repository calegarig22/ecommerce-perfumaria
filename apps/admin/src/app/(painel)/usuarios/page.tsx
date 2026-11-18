import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { isFreshLogin, requireAdmin } from "@/lib/session";
import { FRESH_LOGIN_MESSAGE } from "@/components/auth-errors";
import { PageHeader } from "@/components/page-header";
import { NewUser, UserRow } from "./users-client";

export const metadata: Metadata = { title: "Usuários" };

/** Acessos ao painel. Só o perfil Admin vê esta página. */
export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await db()
    .select({
      id: s.adminUsers.id,
      name: s.adminUsers.name,
      email: s.adminUsers.email,
      role: s.adminUsers.role,
      twoFactorEnabled: s.adminUsers.twoFactorEnabled,
      requireTwoFactor: s.adminUsers.requireTwoFactor,
      createdAt: s.adminUsers.createdAt,
    })
    .from(s.adminUsers)
    .orderBy(asc(s.adminUsers.createdAt));

  return (
    <>
      <PageHeader title="Usuários" subtitle="Quem pode entrar no painel. Toda mudança fica no Histórico." />
      {!isFreshLogin(me.session) && (
        <p role="alert" className="mb-6 rounded-md bg-caramel/15 p-3 text-sm">{FRESH_LOGIN_MESSAGE}</p>
      )}

      <section className="card mb-8 p-5">
        <h2 className="mb-4 font-display text-xl">Novo acesso</h2>
        <NewUser />
      </section>

      <ul className="space-y-3">
        {users.map((u) => (
          <UserRow key={u.id} me={u.id === me.id} u={{ ...u, twoFactorEnabled: !!u.twoFactorEnabled, createdAt: u.createdAt.toISOString() }} />
        ))}
      </ul>
    </>
  );
}
