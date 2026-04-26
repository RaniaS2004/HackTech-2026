import { Shield, Key, Fingerprint } from "lucide-react";

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative rounded-2xl border border-border bg-card/50 p-8 backdrop-blur-sm transition-all hover:border-primary/40">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative">
        <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
          <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
        </div>
        <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="relative py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mb-3 inline-flex items-center gap-2">
            <span className="h-px w-6 bg-primary" />
            <span className="text-xs font-medium uppercase tracking-widest text-primary">
              How it works
            </span>
            <span className="h-px w-6 bg-primary" />
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Two challenges. One identity layer.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <FeatureCard
            icon={Shield}
            title="HumanLock"
            description="Next-gen CAPTCHA. Adversarial image challenges that AI vision models cannot solve — generated fresh every request."
          />
          <FeatureCard
            icon={Key}
            title="AgentPass"
            description="Reverse CAPTCHA. Lets legitimate AI agents prove they're authorized. Issues signed identity tokens on success."
          />
        </div>

        <div className="mx-auto mt-5 max-w-2xl">
          <FeatureCard
            icon={Fingerprint}
            title="Agent Fingerprinting"
            description="Identifies which AI model is visiting — GPT-4o, Claude, and more — from timing and behavior patterns alone."
          />
        </div>
      </div>
    </section>
  );
}
