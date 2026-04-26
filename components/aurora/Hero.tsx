import Image from "next/image";
import Link from "next/link";

export function Hero() {
  const pills = ["Adversarial CAPTCHA", "Agent verification", "Signed identity"];

  return (
    <section id="home" className="relative flex min-h-screen items-center overflow-hidden pb-16 pt-28">
      <div className="pointer-events-none absolute inset-0 grid-bg animate-grid opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[140px]" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2">
        <div className="text-left">
          <div className="mb-6 inline-flex items-center gap-2">
            <span className="h-px w-6 bg-primary" />
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Dual-sided identity layer</span>
            <span className="h-px w-6 bg-primary" />
          </div>
          <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            <span className="text-foreground">Know who is </span>
            <span className="text-iridescent">really</span>
            <span className="text-foreground"> on your site.</span>
          </h1>
          <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            AURORA separates humans from AI agents. Block bots that should not get in, and verify trusted agents with signed identity.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/humanlock"
              className="glow-accent group relative overflow-hidden rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground transition-all hover:bg-primary-glow"
            >
              Try HumanLock
            </Link>
            <Link
              href="/agentpass"
              className="rounded-xl border border-border bg-secondary/40 px-8 py-4 text-base font-semibold backdrop-blur-md transition-colors hover:border-primary/40 hover:bg-secondary"
            >
              Try AgentPass
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            {pills.map((pill) => (
              <span key={pill} className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="relative flex aspect-square items-center justify-center">
          <div className="absolute inset-[15%] rounded-full bg-primary/20 blur-[80px]" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="animate-ring absolute h-[55%] w-[55%] rounded-full border border-primary/30" />
            <div className="animate-ring absolute h-[55%] w-[55%] rounded-full border border-cyan-400/20 [animation-delay:1.3s]" />
            <div className="animate-ring absolute h-[55%] w-[55%] rounded-full border border-fuchsia-400/20 [animation-delay:2.6s]" />
          </div>
          <div className="relative z-10">
            <Image
              src="/aurora/aurora-bot.png"
              alt="AURORA glassy iridescent robot"
              width={1024}
              height={1024}
              priority
              className="w-full max-w-md opacity-[0.93] drop-shadow-[0_0_60px_oklch(0.62_0.21_280_/_0.45)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
