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

export function AgentPassDemo() {
  return (
    <section id="agentpass" className="relative py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <div className="mb-3 inline-flex items-center gap-2">
            <span className="h-px w-6 bg-primary" />
            <span className="text-xs font-medium uppercase tracking-widest text-primary">
              AgentPass
            </span>
            <span className="h-px w-6 bg-primary" />
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Signed identity for legitimate agents.
          </h2>
          <p className="mt-4 text-muted-foreground">
            AI agents prove who they are with a cryptographic challenge — and get a JWT in return.
          </p>
        </div>

        <div className="relative mx-auto max-w-md rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-md">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/5 to-transparent" />
          <div className="relative flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">🤖 AI Agent</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                session: ap_3c91
              </span>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 font-mono text-[11px] leading-relaxed">
              <div className="mb-2 text-muted-foreground"># challenge.json</div>
              <div className="text-foreground">
                <span className="text-muted-foreground">{"{"}</span>
                <br />
                {"  "}<span className="text-primary">"nonce"</span>: <span className="text-success">"4f8e...c2a1"</span>,
                <br />
                {"  "}<span className="text-primary">"sign"</span>: <span className="text-success">"ed25519"</span>,
                <br />
                {"  "}<span className="text-primary">"ttl"</span>: <span className="text-success">300</span>
                <br />
                <span className="text-muted-foreground">{"}"}</span>
              </div>
              <div className="mt-3 rounded border border-success/30 bg-success/5 p-2 text-success">
                ✓ token verified · jwt issued
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Badge pass={false} label="Failed HumanLock" />
              <Badge pass label="Passed AgentPass" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
