import type { MetadataRoute } from "next";
import { caseStudies } from "@/data/resume";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "monthly", priority: 1 },
    ...caseStudies.map((c) => ({ url: `${siteUrl}/work/${c.id}`, changeFrequency: "yearly" as const, priority: 0.7 })),
  ];
}
