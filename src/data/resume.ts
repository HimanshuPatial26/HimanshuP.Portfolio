// Single source of truth for portfolio content.
// Every number here comes straight from Himanshu's resume. Do not add new figures.

export const profile = {
  name: "Himanshu Patial",
  title: "AI & Growth Product Manager",
  location: "Sharjah, UAE",
  email: "hppatial@gmail.com",
  resumeUrl: "/Himanshu-Patial-Resume.pdf",
  summary:
    "Product Manager with 2+ years in EdTech, shipping AI/LLM products, payments, conversion and process automation across B2B and D2C. I pair product strategy with hands-on execution and let the data make the call. Three years in customer support before that taught me to start with the user.",
  focusAreas: [
    "AI tutors",
    "conversion engines",
    "payment recovery",
    "sales automation",
  ],
};

export type Metric = {
  value: number;
  from?: number; // start of the count, so ranges never read wrong mid-animation
  prefix?: string;
  suffix?: string;
  lead?: string; // static text before the animated number, e.g. "10–"
  label: string;
  note: string;
  /** a small picture of what the number means, drawn only from the figures on the resume */
  visual:
    | { kind: "currency"; alt: string; altNote: string } // the same figure in US dollars
    | { kind: "lift"; pct: number } // before = 100, after = 100 + pct
    | { kind: "range"; from: number; to: number } // a lift known as a range
    | { kind: "benchmark"; team: [number, number]; industry: [number, number] }; // against the industry
  /** where the story behind the number lives */
  link: { href: string; label: string };
};

export const metrics: Metric[] = [
  {
    value: 4,
    prefix: "₹",
    suffix: "M",
    label: "monthly revenue",
    note: "from AI-Convert (~US $50K)",
    visual: { kind: "currency", alt: "$50K", altNote: "from AI-Convert (~₹4M)" },
    link: { href: "/work/ai-convert", label: "See how" },
  },
  {
    value: 30,
    prefix: "+",
    suffix: "%",
    label: "agent productivity",
    note: "CRM with automatic dialer",
    visual: { kind: "lift", pct: 30 },
    link: { href: "/work/crm-lms", label: "See how" },
  },
  {
    value: 15,
    from: 10,
    lead: "+10–",
    suffix: "%",
    label: "successful payments",
    note: "WhatsApp recovery journeys",
    visual: { kind: "range", from: 10, to: 15 },
    link: { href: "/work/payment-recovery", label: "See how" },
  },
  {
    value: 90,
    from: 89,
    lead: "89–",
    suffix: "%",
    label: "CSAT, 16-person team",
    note: "vs. 78–85% industry benchmark",
    visual: { kind: "benchmark", team: [89, 90], industry: [78, 85] },
    link: { href: "#journey", label: "See the role" },
  },
];

export type Track = "AI" | "Growth";

export type CaseStudy = {
  id: string; // also the URL slug: /work/<id>
  shape: "Shape_Phone" | "Shape_Curve" | "Shape_Globe" | "Shape_Stairs"; // particle shape on its page
  name: string;
  kind: string;
  tracks: Track[];
  problem: string;
  built: string;
  result: string;
  resultIsMetric: boolean;
  /** A live, looping figure in public/figures, shown on the card instead of the tile render. */
  figure?: string;
};

export const caseStudies: CaseStudy[] = [
  {
    id: "doubt-mate",
    shape: "Shape_Phone",
    name: "Doubt Mate",
    kind: "AI tutor chatbot",
    tracks: ["AI"],
    problem:
      "Students got stuck on course questions outside class hours, with nobody to ask.",
    built:
      "Defined the requirements, user flows and a RAG strategy that grounds every answer in the course material.",
    result: "On-demand academic help, with answers tied to the course to curb hallucinations.",
    resultIsMetric: false,
    figure: "/figures/doubt-mate.html",
  },
  {
    id: "call-analysis",
    shape: "Shape_Curve",
    name: "AI Call Analysis",
    kind: "Internal AI tool",
    tracks: ["AI"],
    problem:
      "The quality team reviewed sales calls by hand, and leadership had little view of lead quality.",
    built:
      "Built a tool that reviews calls automatically and surfaces lead-quality insights so leaders can redirect reps and refine campaigns.",
    result: "+8–10% quality-team productivity",
    resultIsMetric: true,
    figure: "/figures/call-analysis.html",
  },
  {
    id: "ai-convert",
    shape: "Shape_Curve",
    name: "AI-Convert",
    kind: "Activity-triggered conversion engine",
    tracks: ["AI", "Growth"],
    problem:
      "Clients were losing buyers who showed intent but never reached checkout.",
    built:
      "Launched an engine that reacts to user activity and triggers the right conversion nudge at the right moment.",
    result: "₹4M (~US $50K) in monthly revenue",
    resultIsMetric: true,
    figure: "/figures/ai-convert.html",
  },
  {
    id: "payment-recovery",
    shape: "Shape_Phone",
    name: "Payment Recovery",
    kind: "WhatsApp re-engagement journeys",
    tracks: ["Growth"],
    problem: "Failed and abandoned payments were leaking revenue.",
    built:
      "Designed WhatsApp journeys that bring users back to finish a payment that failed or was dropped.",
    result: "+10–15% successful transactions",
    resultIsMetric: true,
    figure: "/figures/payment-recovery.html",
  },
  {
    id: "crm-lms",
    shape: "Shape_Stairs",
    name: "CRM + Lead Scoring",
    kind: "Internal and client-facing sales stack",
    tracks: ["Growth"],
    problem:
      "Agents juggled calls and customer data across tools, and every lead got the same pitch.",
    built:
      "Developed a CRM with an automatic dialer, paired with a scoring-based Lead Management System that matches each lead to the right product.",
    result: "+30% agent productivity",
    resultIsMetric: true,
  },
  {
    id: "super-coaching",
    shape: "Shape_Phone",
    name: "Super Coaching Onboarding",
    kind: "In-app onboarding overlay",
    tracks: ["Growth"],
    problem: "A high-value user segment was dropping off before converting.",
    built:
      "Shipped an in-app onboarding overlay aimed squarely at that segment.",
    result: "+7% conversion rate",
    resultIsMetric: true,
  },
];

export type Role = {
  title: string;
  company: string;
  place: string;
  period: string;
  points: string[];
};

export const experience: Role[] = [
  {
    title: "Associate Product Manager",
    company: "Classplus",
    place: "UP, India",
    period: "Mar 2023 – Aug 2025",
    points: [
      "Led the AI tutor chatbot Doubt Mate from requirements to a RAG strategy that keeps answers grounded in course material.",
      "Built an AI call-analysis tool that automated manual call reviews and lifted quality-team productivity 8–10%.",
      "Launched AI-Convert, an activity-triggered conversion engine generating ₹4M (~US $50K) a month.",
      "Designed WhatsApp recovery journeys for failed and abandoned payments, raising successful transactions 10–15%.",
      "Developed a CRM with an automatic dialer plus a scoring-based lead system, lifting agent productivity 30%.",
      "Shipped an onboarding overlay for Super Coaching that raised conversion 7%.",
    ],
  },
  {
    title: "Deputy Lead, Customer Delight",
    company: "Classplus",
    place: "UP, India",
    period: "Apr 2020 – Mar 2023",
    points: [
      "Led a 16-person support team, holding CSAT at 89–90% against an industry benchmark of 78–85%.",
      "Resolved 90% of support tickets within 6 hours without dropping quality.",
      "Reworked support workflows, raising agent productivity 40%.",
    ],
  },
];

export type Project = {
  name: string;
  org: string;
  period: string;
  summary: string;
  tools: string[];
};

export const projects: Project[] = [
  {
    name: "Drivers of FinTech App Adoption Intention",
    org: "A comparative study of India and Dubai",
    period: "Jan 2026 – Apr 2026",
    summary:
      "Surveyed 71 respondents across two markets and modeled the results with PLS-SEM, explaining 96% of the variance in adoption intention. Identified market-specific growth drivers and recommended a go-to-market approach for each.",
    tools: ["SmartPLS 4", "PLS-SEM", "Survey design"],
  },
  {
    name: "Rebel Foods (Behrouz Biryani), Dubai",
    org: "Global Industry Project",
    period: "Ongoing",
    summary:
      "Benchmarked Behrouz Biryani against key rivals in the UAE food delivery market. Recommended changes to positioning, pricing and channel mix, built on a category insight that challenged the brand's core assumption about the UAE.",
    tools: ["PESTLE", "CAGE", "Porter's Five Forces"],
  },
];

export const skills: { group: string; items: string[] }[] = [
  { group: "Product", items: ["Roadmapping", "A/B testing", "Stakeholder management"] },
  { group: "AI / ML", items: ["LLM products", "RAG", "Vector DBs", "Conversational AI"] },
  {
    group: "Technical",
    items: ["SQL", "Python", "JavaScript", "Power BI", "Excel", "Postman", "Apps Script"],
  },
  { group: "Tools & methods", items: ["Jira", "Notion", "Figma", "Scrum", "Kanban"] },
];

export const education = [
  {
    degree: "Master of Global Business",
    detail: "Global Marketing Management",
    school: "SP Jain School of Global Management",
    place: "Singapore · London · Dubai",
    period: "Oct 2025 – present",
  },
  {
    degree: "Bachelor of Business Administration",
    detail: "",
    school: "GGSIPU",
    place: "New Delhi, India",
    period: "Aug 2016 – Sep 2019",
  },
];
