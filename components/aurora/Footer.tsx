import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-3 sm:flex-row">
        <Logo />
        <p className="text-xs text-muted-foreground">
          A dual-sided identity layer for the agentic web · By Areesha Imtiaz & Rana Souissi · Built at Hacktech 2026
        </p>
      </div>
    </footer>
  );
}
