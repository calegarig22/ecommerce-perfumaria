import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <p className="font-display text-3xl">Página não encontrada</p>
        <Link href="/" className="mt-4 inline-block text-accent hover:underline">Voltar ao início</Link>
      </div>
    </main>
  );
}
