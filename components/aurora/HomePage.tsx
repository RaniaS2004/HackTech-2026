"use client";

import { useEffect, useRef } from "react";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Nav } from "./Nav";

function FadeSection({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio >= 0.35) {
            el.classList.add("section-in");
          } else {
            el.classList.remove("section-in");
          }
        });
      },
      { threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1], rootMargin: "-15% 0px -15% 0px" },
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

export function HomePage() {
  return (
    <main className="min-h-screen bg-background pb-20 text-foreground">
      <Nav />
      <FadeSection>
        <Hero />
      </FadeSection>
      <FadeSection>
        <HowItWorks />
      </FadeSection>
      <Footer />
    </main>
  );
}
