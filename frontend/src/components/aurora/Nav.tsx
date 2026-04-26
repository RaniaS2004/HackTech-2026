import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

const HASH_LINKS = [
  { href: "/#home", label: "Home" },
  { href: "/#how", label: "How it works" },
];

const HASH_LINKS_AFTER: { href: string; label: string }[] = [];

export function Nav() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="shrink-0">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {HASH_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
          <Link
            to="/humanlock"
            className="transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            HumanLock
          </Link>
          <Link
            to="/agentpass"
            className="transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            AgentPass
          </Link>
          {HASH_LINKS_AFTER.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>
        <Link
          to="/humanlock"
          className="rounded-md border border-border bg-secondary/50 px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Get access
        </Link>
      </div>
    </header>
  );
}
