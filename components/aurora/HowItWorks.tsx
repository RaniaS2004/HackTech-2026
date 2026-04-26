import type { SVGProps } from "react";
import { BotIcon, KeyIcon, ShieldIcon, UserIcon } from "./icons";

function Step({
  icon: Icon,
  label,
  tone = "primary",
}: {
  icon: (props: SVGProps<SVGSVGElement>) => React.ReactNode;
  label: string;
  tone?: "primary" | "cyan";
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tone === "cyan" ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300" : "border-primary/40 bg-primary/10 text-primary"}`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-sm font-semibold text-foreground">{label}</span>
    </div>
  );
}

function PathCard({
  icon: Icon,
  title,
  eyebrow,
  description,
  tone = "primary",
}: {
  icon: (props: SVGProps<SVGSVGElement>) => React.ReactNode;
  title: string;
  eyebrow: string;
  description: string;
  tone?: "primary" | "cyan";
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/35 p-7 backdrop-blur-sm">
      <div className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl ${tone === "cyan" ? "bg-cyan-400/10" : "bg-primary/10"}`} />
      <div className="relative flex items-start justify-between gap-5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${tone === "cyan" ? "border-cyan-400/35 bg-cyan-400/10 text-cyan-300" : "border-primary/35 bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${tone === "cyan" ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" : "border-primary/30 bg-primary/10 text-primary"}`}>
          {eyebrow}
        </span>
      </div>
      <h3 className="relative mt-8 text-2xl font-semibold tracking-tight">{title}</h3>
      <p className="relative mt-4 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden py-28">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-25" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-3">
            <span className="h-px w-8 bg-primary" />
            <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">How it works</span>
            <span className="h-px w-8 bg-primary" />
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Two paths. One <span className="text-iridescent">identity</span> layer.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Humans get a challenge built for people. Agents get a challenge built for agents.
          </p>
        </div>

        <div className="mt-16 rounded-2xl border border-border bg-background/55 p-5 backdrop-blur-md">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto_1.4fr_auto_1fr_auto_1.2fr] lg:items-center">
            <Step icon={UserIcon} label="Human arrives" tone="cyan" />
            <span className="hidden text-muted-foreground lg:block">-&gt;</span>
            <Step icon={ShieldIcon} label="HumanLock checks image + behavior" tone="cyan" />
            <span className="hidden text-muted-foreground lg:block">-&gt;</span>
            <Step icon={BotIcon} label="Trusted agent arrives" />
            <span className="hidden text-muted-foreground lg:block">-&gt;</span>
            <Step icon={KeyIcon} label="AgentPass verifies + signs" />
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <PathCard
            icon={ShieldIcon}
            title="HumanLock"
            eyebrow="For humans"
            description="HumanLock uses adversarial images and behavior signals to block automated visitors while keeping the task simple for people."
            tone="cyan"
          />
          <PathCard
            icon={KeyIcon}
            title="AgentPass"
            eyebrow="For agents"
            description="AgentPass gives trusted AI agents a way to prove themselves with proof-of-work, signed tokens, and optional Solana reputation."
          />
        </div>
      </div>
    </section>
  );
}
