import { projects as resumeProjects } from "@/data/resume";

/*
 * Projects: two products built independently (CallEvals, AI Med-pedia) and two
 * academic projects from the Master's at SP Jain. Facts come only from the
 * products' own repos (README, PRD, code) and Himanshu's launch films; the
 * academic ones come from the resume.
 */

/** One scroll chapter on a project page: its words, and the stretch of film it scrubs through. */
export type Chapter = {
  id: string;
  label: string; // the rail's short name
  title: string;
  body: string[];
  /** which video the chapter scrubs: the main film or (CallEvals) the builder's log */
  media: "scrub" | "log";
  /** seconds in that video: the chapter's first and last frame */
  at: [number, number];
  stats?: { value: string; label: string }[];
  list?: { label: string; value: string }[];
  listTitle?: string;
  interactive?: "eval" | "tones" | "plain";
};

export type BuiltProject = {
  slug: "callevals" | "ai-med-pedia";
  name: string;
  /** index row and card line */
  line: string;
  tagline: string;
  year: string;
  status: string;
  tags: string[];
  /** the product's own colour, used inside its page (light-theme variant for contrast on grey) */
  accent: { dark: string; light: string; rgb: string };
  links: { label: string; href: string }[];
  facts: { label: string; value: string }[];
  stack: string[];
  video: {
    loop: string;
    loopWebm?: string;
    loopPoster: string;
    film: string;
    filmLength: string;
    scrub: string;
    scrubPoster: string;
    /** the hero's muted loop starts here (skips a black cold open) */
    heroFrom: number;
    log?: string;
    logPoster?: string;
  };
  chapters: Chapter[];
};

export const builtProjects: BuiltProject[] = [
  {
    slug: "callevals",
    name: "CallEvals",
    line: "Sales-call intelligence for GCC real estate brokerages",
    tagline: "AI sales-call reviews for Dubai real estate brokerages.",
    year: "2026",
    status: "Live",
    tags: ["PRD", "Evals", "Live app"],
    accent: { dark: "#f2953f", light: "#a8530a", rgb: "242 149 63" },
    links: [
      { label: "Live app", href: "https://call-evals.vercel.app" },
      { label: "PRD", href: "https://github.com/HimanshuPatial26/CallEvals/blob/main/docs/PRD.md" },
      { label: "Code", href: "https://github.com/HimanshuPatial26/CallEvals" },
    ],
    facts: [
      { label: "For", value: "Dubai and Abu Dhabi brokerages, 20–150 agents" },
      { label: "Ships", value: "Summary, dated next steps, objection tags, coaching flags" },
      { label: "Tested", value: "6 scripted calls against hand-labelled answers" },
      { label: "Role", value: "PRD, product design and build" },
    ],
    stack: ["FastAPI", "faster-whisper", "Deepgram", "Gemini 2.5 Flash", "React", "Render + Vercel"],
    video: {
      loop: "/projects/callevals/loop.mp4",
      loopPoster: "/projects/callevals/poster.jpg",
      film: "/projects/callevals/film.mp4",
      filmLength: "0:24",
      scrub: "/projects/callevals/scrub.mp4",
      scrubPoster: "/projects/callevals/scrub-poster.jpg",
      heroFrom: 0,
      log: "/projects/callevals/log.mp4",
      logPoster: "/projects/callevals/log-poster.jpg",
    },
    chapters: [
      {
        id: "problem",
        label: "Problem",
        title: "Agent quality varies wildly. On these deals, that's expensive.",
        body: [
          "Dubai brokerages run 20 to 150 agents, and the gap between their best and worst calls is wide. With an average ticket above AED 1.5M, a small shift in conversion is material.",
          "Today a manager spot-checks a handful of calls a month and coaches on instinct.",
        ],
        media: "scrub",
        at: [0, 5.3],
        stats: [
          { value: "AED 1.5M+", label: "Average ticket" },
          { value: "20–150", label: "Agents per brokerage" },
        ],
      },
      {
        id: "gap",
        label: "Gap",
        title: "Built for enterprise. Nothing for a 40-agent brokerage.",
        body: [
          "Call intelligence exists, but it's priced and built for software sales teams: annual contracts, procurement cycles, six-figure deals. A 40-agent brokerage can't justify it and would use perhaps a tenth of it.",
          "So the opening isn't the technology. It's the price point, the vertical and the scope.",
        ],
        media: "scrub",
        at: [5.4, 13.2],
      },
      {
        id: "product",
        label: "Product",
        title: "Calls in. Coaching out.",
        body: ["A deliberately small product. Upload a call recording and get back:"],
        media: "scrub",
        at: [13.4, 21.3],
        list: [
          { label: "Summary", value: "What the customer wants, budget, timeline, deal state. Under 150 words." },
          { label: "Next steps", value: "What the rep committed to, and by when." },
          { label: "Objections", value: "Price, timing or competitor, in the customer's own words." },
          { label: "Coaching flags", value: "Rule-based: monologues, too few discovery questions, no dated next step." },
        ],
        listTitle: "What it returns",
      },
      {
        id: "proof",
        label: "Proof",
        title: "Run 1: 75%. Run 2: 100%.",
        body: [
          "The riskiest assumption: if a manager catches two wrong summaries, they stop reading all of them. So before any customer, I tested extraction on six scripted calls with hand-labelled answers.",
          "Run 1 missed the 85% launch gate because the model split one promise into two. One prompt rule to merge near-duplicates fixed it, and recall held at 100% throughout.",
        ],
        media: "log",
        at: [0, 14],
        interactive: "eval",
      },
      {
        id: "next",
        label: "Next",
        title: "Measured, not assumed.",
        body: [
          "Six calls is directional. Next is real brokerage audio, then a pilot with design partners under written data agreements. CRM sync comes after that, because win-rate metrics depend on it.",
          "Some things are cut on purpose: a single call score gets gamed and reads as surveillance, and deal prediction needs hundreds of closed deals first.",
        ],
        media: "log",
        at: [14, 22],
        stats: [
          { value: "≈ $0.23", label: "Inference per call (PRD estimate)" },
          { value: "~80%", label: "Gross margin at $49 a seat" },
        ],
      },
    ],
  },
  {
    slug: "ai-med-pedia",
    name: "AI Med-pedia",
    line: "Medical answers from your documents and the live web",
    tagline: "Health answers with sources, a safety read and plain language. It informs; it never diagnoses.",
    year: "2026",
    status: "Built",
    tags: ["RAG", "2 models", "Safety"],
    accent: { dark: "#8fa2ff", light: "#3e56d6", rgb: "143 162 255" },
    // the code link is added once the repo is public (it is private, so visitors would see a 404)
    links: [],
    facts: [
      { label: "Reads", value: "PDFs, Word files, notes and CSVs you upload" },
      { label: "Searches", value: "The live web, and shows its sources" },
      { label: "Models", value: "Llama 3.3 70B or Gemini 2.5 Flash" },
      { label: "Flags", value: "Urgent, caution or steady, on every answer" },
    ],
    stack: ["FastAPI", "Pinecone", "Gemini embeddings", "Supabase", "Tavily", "Groq", "Next.js"],
    video: {
      loop: "/projects/ai-med-pedia/loop.mp4",
      loopWebm: "/projects/ai-med-pedia/loop.webm",
      loopPoster: "/projects/ai-med-pedia/loop.jpg",
      film: "/projects/ai-med-pedia/film.mp4",
      filmLength: "0:21",
      scrub: "/projects/ai-med-pedia/scrub.mp4",
      scrubPoster: "/projects/ai-med-pedia/poster.jpg",
      heroFrom: 5.4,
    },
    chapters: [
      {
        id: "ask",
        label: "Ask",
        title: "Ask it anything about your health.",
        body: [
          "Describe a symptom or name a medication. The answer streams in as it's written, and the conversation keeps its context: recent messages, plus a running summary every ten.",
        ],
        media: "scrub",
        at: [0.3, 5.2],
      },
      {
        id: "sources",
        label: "Sources",
        title: "Every answer, sourced.",
        body: [
          "Each question pulls the five closest passages from your own documents (Gemini embeddings in Pinecone) and, when you switch it on, live web results with their links.",
        ],
        media: "scrub",
        at: [8.0, 10.6],
      },
      {
        id: "safety",
        label: "Safety",
        title: "It flags emergencies.",
        body: [
          "Every answer carries a safety read. Urgent ones tell you to call emergency services right away. It educates and informs; it never diagnoses or prescribes.",
        ],
        media: "scrub",
        at: [10.7, 15.9],
        interactive: "tones",
      },
      {
        id: "plain",
        label: "Plain words",
        title: "Clinical detail, or plain language.",
        body: [
          "One switch changes how it explains: precise clinical terms for a well-informed reader, or everyday words with any jargon explained in the same sentence.",
        ],
        media: "scrub",
        at: [16.0, 18.6],
        interactive: "plain",
      },
      {
        id: "stack",
        label: "Under the hood",
        title: "Stop doom-googling.",
        body: [
          "A FastAPI backend streams answers from Llama 3.3 70B on Groq or Gemini 2.5 Flash, your pick. Supabase keeps the conversations, and every thumbs up or down on an answer is saved.",
        ],
        media: "scrub",
        at: [18.7, 23.6],
      },
    ],
  },
];

export type AcademicProject = {
  id: string;
  kind: "Research" | "Strategy";
  name: string;
  line: string;
  period: string;
  ongoing: boolean;
  summary: string;
  tools: string[];
  facts: { label: string; value: string; key?: boolean }[];
};

const [fintech, rebel] = resumeProjects;

export const academicProjects: AcademicProject[] = [
  {
    id: "fintech-adoption",
    kind: "Research",
    name: "Drivers of FinTech app adoption",
    line: "India × Dubai · PLS-SEM study",
    period: fintech.period,
    ongoing: false,
    summary: fintech.summary,
    tools: fintech.tools,
    facts: [
      { label: "Sample", value: "71 respondents across two markets" },
      { label: "Method", value: "PLS-SEM in SmartPLS 4" },
      { label: "Result", value: "96% of the variance in adoption intention explained", key: true },
      { label: "Output", value: "A go-to-market approach for each market" },
    ],
  },
  {
    id: "rebel-foods",
    kind: "Strategy",
    name: "Rebel Foods · Behrouz Biryani",
    line: "UAE food delivery · Global Industry Project",
    period: rebel.period,
    ongoing: true,
    summary: rebel.summary,
    tools: rebel.tools,
    facts: [
      { label: "Brief", value: "Benchmark the brand against key UAE rivals" },
      { label: "Lenses", value: "PESTLE · CAGE · Porter's Five Forces" },
      { label: "Output", value: "Changes to positioning, pricing and channel mix" },
      { label: "Hook", value: "A category insight that challenged the brand's core assumption", key: true },
    ],
  },
];

export const projectBySlug = (slug: string) => builtProjects.find((p) => p.slug === slug);
