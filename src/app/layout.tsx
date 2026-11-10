import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Syne } from "next/font/google";
import SceneMount from "@/components/scene/SceneMount";
import Opening from "@/components/Opening";
import FilmOverlay from "@/components/FilmOverlay";
import SoundToggle from "@/components/SoundToggle";
import SmoothScroll from "@/components/SmoothScroll";
import SiteChrome from "@/components/SiteChrome";
import ThemeToggle from "@/components/ThemeToggle";
import RouteTransition from "@/components/RouteTransition";
import Sparks from "@/components/Sparks";
import { themeInitScript } from "@/hooks/useTheme";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face: Syne (set at Regular), for headlines, figures and the small
// uppercase labels. Geist stays for body copy.
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const title = "Himanshu Patial · AI & Growth Product Manager";
const description =
  "Product Manager shipping AI/LLM products, payments, conversion and automation. AI-Convert drove ₹4M a month; payment recovery lifted successful transactions 10–15%.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: "%s · Himanshu Patial" },
  description,
  openGraph: { title, description, type: "website", siteName: "Himanshu Patial" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#d4d4d4" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} h-full antialiased`}
    >
      <head>
        {/* set the saved theme before first paint (no flash) */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SceneMount />
        <Opening />
        <FilmOverlay />
        <SmoothScroll />
        <RouteTransition />
        <SiteChrome />
        <SoundToggle />
        <ThemeToggle />
        <Sparks>
          <main id="main">{children}</main>
        </Sparks>
      </body>
    </html>
  );
}
