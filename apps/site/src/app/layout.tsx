import type { Metadata, Viewport } from "next";
import { Gilda_Display, Jost } from "next/font/google";
import { CartProvider } from "@/components/cart";
import { Header } from "@/components/header";
import { getCatalog } from "@/lib/catalog";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { Footer } from "@/components/footer";
import { indexable, site } from "@/lib/site";
import "./globals.css";

// Títulos: serifa de alto contraste, parente das letras da logo; acentos do português bem desenhados.
const gilda = Gilda_Display({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-gilda",
  display: "swap",
});

// Texto e interface: geométrica limpa (família Futura), leitura confortável.
const jost = Jost({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: `${site.name} | Perfumaria artesanal`, template: `%s | ${site.name}` },
  description: site.description,
  openGraph: { type: "website", locale: "pt_BR", siteName: site.name },
  robots: indexable ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#2e2420",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { lines } = await getCatalog();
  const navLines = lines.map(({ slug, name, shortName }) => ({ slug, name, shortName }));
  return (
    <html lang="pt-BR" className={`${gilda.variable} ${jost.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <CartProvider>
          <Header lines={navLines} />
          <main id="conteudo" className="flex-1">
            {children}
          </main>
          <Footer />
          <WhatsAppButton />
        </CartProvider>
      </body>
    </html>
  );
}
