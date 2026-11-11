import type { MetadataRoute } from "next";
import { caseStudies } from "@/data/resume";
import { academicProjects, builtProjects } from "@/data/projects";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "monthly", priority: 1 },
    ...builtProjects.map((p) => ({ url: `${siteUrl}/projects/${p.slug}`, changeFrequency: "yearly" as const, priority: 0.8 })),
    ...academicProjects.map((p) => ({ url: `${siteUrl}/projects/${p.id}`, changeFrequency: "yearly" as const, priority: 0.7 })),
    ...caseStudies.map((c) => ({ url: `${siteUrl}/work/${c.id}`, changeFrequency: "yearly" as const, priority: 0.7 })),
  ];
}
