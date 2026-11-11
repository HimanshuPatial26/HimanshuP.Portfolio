import type { Metadata } from "next";
import { AcademicArticle, AcademicHeader, MethodSection, NextAcademic } from "@/components/academic/AcademicChrome";
import BehrouzStory from "@/components/academic/BehrouzStory";
import { academicById } from "@/data/projects";

const p = academicById("behrouz-biryani")!;
const next = academicById("fintech-adoption")!;

export const metadata: Metadata = {
  title: "Behrouz Biryani, UAE",
  description: p.tagline,
  openGraph: {
    title: "Behrouz Biryani, UAE · Himanshu Patial",
    description: p.tagline,
    images: [{ url: "/projects/behrouz-biryani/closed.jpg", width: 1280, height: 800 }],
  },
};

export default function BehrouzPage() {
  return (
    <AcademicArticle p={p}>
      <BehrouzStory header={<AcademicHeader p={p} title="Behrouz Biryani" subtitle="Winning the group order in the UAE" />} />
      <MethodSection
        title="Three kinds of evidence, and conclusions only where they agreed."
        streams={[
          {
            label: "Consumer survey",
            body: "A 33-item survey of UAE delivery users: 153 responses, 136 kept after residency, recency and attention checks. Seven-point scales; Cronbach's α 0.79–0.88. Regression, bootstrapped mediation (5,000 resamples), moderation, chi-square and t-tests, in Python.",
          },
          {
            label: "Kitchen visit",
            body: "A site visit and interview with the operator of a Dubai cloud kitchen. The operator named consistency, unprompted, as the main weakness. The kitchen's own figures stay private.",
          },
          {
            label: "Platform audit",
            body: "Dated captures of Talabat listings for seven biryani brands, scored against a written rubric, plus 15 peer-reviewed sources and public market, company and regulatory filings.",
          },
        ]}
        tags={["PESTLE", "CAGE distance", "Porter's Five Forces", "Blue Ocean", "Positioning map", "Path model", "Python"]}
        note="Team 1's Global Industry Project for Rebel Foods at SP Jain School of Global Management: a team of three. Ethics approval came before launch, and responses were anonymous. The Dum Crown pack is a presentation concept, not a manufacturing design."
      />
      <NextAcademic next={next} />
    </AcademicArticle>
  );
}
