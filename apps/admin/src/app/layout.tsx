import type { Metadata, Viewport } from "next";
import { Gilda_Display, Jost } from "next/font/google";
import "./globals.css";

const gilda = Gilda_Display({ subsets: ["latin", "latin-ext"], weight: "400", variable: "--font-gilda", display: "swap" });
const jost = Jost({ subsets: ["latin", "latin-ext"], variable: "--font-jost", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Painel da loja", template: "%s · Painel da loja" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#2e2420", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${gilda.variable} ${jost.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
