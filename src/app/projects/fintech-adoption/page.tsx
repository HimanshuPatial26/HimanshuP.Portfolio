import type { Metadata } from "next";
import { AcademicArticle, AcademicHeader, MethodSection, NextAcademic } from "@/components/academic/AcademicChrome";
import FintechStory from "@/components/academic/FintechStory";
import { academicById } from "@/data/projects";

const p = academicById("fintech-adoption")!;
const next = academicById("behrouz-biryani")!;

export const metadata: Metadata = {
  title: "FinTech adoption: India × Dubai",
  description: p.tagline,
  openGraph: { title: "FinTech adoption: India × Dubai · Himanshu Patial", description: p.tagline },
};

export default function FintechPage() {
  return (
    <AcademicArticle p={p}>
      <FintechStory header={<AcademicHeader p={p} title="FinTech adoption" subtitle="India × Dubai: what makes people trust a finance app" />} />
      <MethodSection
        title="One model, two markets, tested separately and side by side."
        streams={[
          {
            label: "Survey",
            body: "A 19-item questionnaire on seven-point scales adapted from validated instruments, with two attention checks. 80 responses, 71 clean: 36 from Mumbai, Bangalore, Delhi-NCR and Hyderabad, 35 from Dubai, Abu Dhabi and Sharjah.",
          },
          {
            label: "Model",
            body: "Extended TAM with signalling and trust-transfer theory: three drivers, two mediators, one outcome. Every construct passed the measurement checks (loadings, α, composite reliability, AVE, HTMT).",
          },
          {
            label: "Analysis",
            body: "PLS-SEM in SmartPLS 4 for each market and the merged sample, bootstrapped (1,000) paths and indirect effects, and multi-group analysis. R² for adoption 0.960 (India) and 0.962 (Dubai); Q² above 0.73.",
          },
        ]}
        tags={["SmartPLS 4", "PLS-SEM", "Mediation", "Multi-group analysis", "SWOT", "PESTEL", "Porter's Five Forces"]}
        note="International Business Research, Master of Global Business, SP Jain School of Global Management. Individual study."
      />
      <NextAcademic next={next} />
    </AcademicArticle>
  );
}
