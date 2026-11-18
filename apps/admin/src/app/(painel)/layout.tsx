import { requireUser } from "@/lib/session";
import { Brand } from "@/components/brand";
import { Nav } from "@/components/nav";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="md:grid md:min-h-dvh md:grid-cols-[14rem_1fr]">
      <aside className="relative border-b border-line bg-paper px-4 py-4 md:border-r md:border-b-0 md:py-6">
        <Brand className="py-1.5 md:py-0" />
        <Nav userName={user.name} role={user.role === "dona" ? "Dona" : "Admin"} />
      </aside>
      <main className="min-w-0 px-4 pt-6 pb-28 md:px-10 md:py-10">{children}</main>
    </div>
  );
}
