import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products } = await getCatalog();
  return [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/loja`, priority: 0.9 },
    { url: `${base}/sobre`, priority: 0.6 },
    ...products.map((p) => ({ url: `${base}/loja/${p.slug}`, priority: 0.7 })),
  ];
}
