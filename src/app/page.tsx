import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import About from "@/components/About";
import Metrics from "@/components/Metrics";
import Work from "@/components/Work";
import Projects from "@/components/Projects";
import Journey from "@/components/Journey";
import Contact from "@/components/Contact";

// Each section tells the particle sculpture which shape to form (data-shape)
// and where to stand (data-pose); see components/scene/ChromeScene.tsx.
export default function Home() {
  return (
    <>
      <Hero />
      <Marquee />
      <About />
      <Metrics />
      <Work />
      <Projects />
      <Journey />
      <Contact />
    </>
  );
}
