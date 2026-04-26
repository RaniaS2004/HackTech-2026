import { Check, X } from "lucide-react";

function Badge({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium ${
        pass
          ? "border-success/30 bg-success/10 text-success"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      }`}
    >
      {pass ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <X className="h-3.5 w-3.5" strokeWidth={2.5} />}
      {label}
    </div>
  );
}

export function HumanLockDemo() {
  return (
    <section id="humanlock" className="relative py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <div className="mb-3 inline-flex items-center gap-2">
            <span className="h-px w-6 bg-primary" />
            <span className="text-xs font-medium uppercase tracking-widest text-primary">
              HumanLock
            </span>
            <span className="h-px w-6 bg-primary" />
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Challenges that only humans can solve.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Adversarial visual puzzles that defeat modern AI vision models.
          </p>
        </div>

        <div className="relative mx-auto max-w-md rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-md">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/5 to-transparent" />
          <div className="relative flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">👤 Human</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                session: hl_8f2a
              </span>
            </div>

            <div className="rounded-lg border border-border bg-card p-3">
              <p className="mb-3 text-xs text-muted-foreground">
                Select all squares with{" "}
                <span className="font-medium text-foreground">street signs</span>
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {[...Array(9)].map((_, i) => (
                  <div
                    key={i}
                    className={`relative aspect-square overflow-hidden rounded border border-border ${
                      [0, 4, 7].includes(i) ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
                    }`}
                    style={{
                      background: `linear-gradient(${(i * 47) % 360}deg, oklch(${0.3 + (i % 4) * 0.08} ${0.04 + (i % 3) * 0.02} ${(i * 50) % 360}), oklch(${0.2 + (i % 3) * 0.06} 0.05 ${(i * 80) % 360}))`,
                    }}
                  >
                    <div
                      className="absolute inset-0 mix-blend-overlay opacity-60"
                      style={{
                        backgroundImage: `repeating-linear-gradient(${i * 30}deg, transparent 0 3px, oklch(1 0 0 / 0.15) 3px 4px)`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <button className="mt-3 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                Verify
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <Badge pass label="Passed HumanLock" />
              <Badge pass={false} label="Failed AgentPass" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
