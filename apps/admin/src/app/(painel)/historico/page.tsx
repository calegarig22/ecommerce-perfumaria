import type { Metadata } from "next";
import { listAudit } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { AuditList } from "@/components/audit-list";

export const metadata: Metadata = { title: "Histórico" };

export default async function HistoryPage() {
  await requireUser();
  const entries = await listAudit(300);
  return (
    <>
      <PageHeader title="Histórico" subtitle="Quem alterou o quê, e quando. Este registro não pode ser apagado pelo painel." />
      <AuditList entries={entries} />
    </>
  );
}
