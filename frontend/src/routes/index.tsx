import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Nav } from "@/components/aurora/Nav";
import { Hero } from "@/components/aurora/Hero";
import { HowItWorks } from "@/components/aurora/HowItWorks";

import { Footer } from "@/components/aurora/Footer";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "AURORA — Identity for the Agentic Web" },
      {
        name: "description",
        content:
          "AURORA is a dual-sided identity layer for the agentic web. Block bots that don't belong, verify the agents that do.",
      },
      { property: "og:title", content: "AURORA — Identity for the Agentic Web" },
      {
        property: "og:description",
        content: "Block the bots that don't belong. Verify the ones that do.",
      },
    ],
  }),
});

function FadeSection({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Use intersection ratio to smoothly fade in/out as section enters or leaves
          const ratio = entry.intersectionRatio;
          if (ratio >= 0.35) {
            el.classList.add("section-in");
          } else {
            el.classList.remove("section-in");
          }
        });
      },
      {
        threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1],
        rootMargin: "-15% 0px -15% 0px",
      }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="section-fade">
      {children}
    </div>
  );
}

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground pb-20">
      <Nav />
      <FadeSection>
        <Hero />
      </FadeSection>
      <FadeSection>
        <HowItWorks />
      </FadeSection>
    </main>
  );
}
