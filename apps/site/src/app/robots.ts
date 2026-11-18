import type { MetadataRoute } from "next";
import { indexable } from "@/lib/site";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  // Pré-lançamento: bloqueia buscadores até NEXT_PUBLIC_SITE_INDEXABLE=true.
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${base}/sitemap.xml` };
}
