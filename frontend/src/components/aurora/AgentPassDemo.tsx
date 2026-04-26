import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, RefreshCcw, X } from "lucide-react";
import { apiUrl } from "@/lib/api";

type AgentChallenge = {
  challenge_id: string;
  challenge: string;
  source: "k2" | "openai" | "fallback";
  expires_at: number;
};

type PowWorkerResult = {
  nonce: number;
  hash: string;
  elapsed_ms: number;
};

type AgentPassResult = {
  passed: boolean;
  reason?: string;
  fingerprint?: {
    model: string;
    confidence: number;
    latency_ms: number;
    pow_ms: number;
  };
  token?: string;
  solana?: {
    signature: string;
    explorer_url: string;
  };
};

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
  const [challenge, setChallenge] = useState<AgentChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [challengeState, setChallengeState] = useState<"loading" | "ready" | "error">("loading");
  const [powState, setPowState] = useState<{ status: "idle" | "running" | "done"; elapsedMs?: number; dots: string }>({
    status: "idle",
    dots: "",
  });
  const [result, setResult] = useState<AgentPassResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const challengeLoadedAtRef = useRef<number>(0);

  const startPow = useCallback((challengeId: string) => {
    workerRef.current?.terminate();
    const worker = new Worker("/pow-worker.js");
    workerRef.current = worker;
    setPowState({ status: "running", dots: "" });

    worker.onmessage = (event: MessageEvent<PowWorkerResult>) => {
      const elapsedMs = Number(event.data?.elapsed_ms);
      setPowState({
        status: "done",
        elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : 0,
        dots: "",
      });
      worker.terminate();
      workerRef.current = null;
    };

    worker.onerror = () => {
      setPowState({ status: "idle", dots: "" });
      setError("Proof-of-work failed");
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({ prefix: challengeId, difficulty: 4 });
  }, []);

  useEffect(() => {
    if (powState.status !== "running") return;

    const timer = window.setInterval(() => {
      setPowState((current) => ({
        ...current,
        dots: current.dots.length >= 3 ? "" : `${current.dots}.`,
      }));
    }, 400);

    return () => window.clearInterval(timer);
  }, [powState.status]);

  const loadChallenge = useCallback(async () => {
    workerRef.current?.terminate();
    setAnswer("");
    setResult(null);
    setError(null);
    setChallenge(null);
    setChallengeState("loading");
    setPowState({ status: "idle", dots: "" });

    try {
      const response = await fetch(apiUrl("/api/agentpass/challenge"), { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`AgentPass challenge failed with ${response.status}`);
      }

      const data = (await response.json()) as AgentChallenge;
      setChallenge(data);
      setChallengeState("ready");
      challengeLoadedAtRef.current = performance.now();
      startPow(data.challenge_id);
    } catch (loadError) {
      setChallengeState("error");
      setError(loadError instanceof Error ? loadError.message : "Failed to load AgentPass challenge");
    }
  }, [startPow]);

  useEffect(() => {
    loadChallenge().catch(() => {});
    return () => workerRef.current?.terminate();
  }, [loadChallenge]);

  const handleSolve = useCallback(async () => {
    if (!challenge || !answer.trim() || powState.status !== "done") return;

    setSubmitting(true);
    setError(null);

    try {
      const responseLatencyMs = Math.round(performance.now() - challengeLoadedAtRef.current);
      const response = await fetch(apiUrl("/api/agentpass/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: challenge.challenge_id,
          answer,
          response_latency_ms: responseLatencyMs,
          pow_time_ms: powState.elapsedMs ?? 0,
        }),
      });

      if (!response.ok) {
        throw new Error(`AgentPass verify failed with ${response.status}`);
      }

      const data = (await response.json()) as AgentPassResult;
      setResult(data);
    } catch (solveError) {
      setError(solveError instanceof Error ? solveError.message : "AgentPass verification failed");
    } finally {
      setSubmitting(false);
    }
  }, [answer, challenge, powState.elapsedMs, powState.status]);

  const powLabel = useMemo(() => {
    if (challengeState === "loading") return "Waiting for challenge...";
    if (challengeState === "error") return "Challenge unavailable.";
    if (powState.status === "running") return `Computing proof-of-work${powState.dots}`;
    if (powState.status === "done") return `PoW solved in ${powState.elapsedMs}ms`;
    return "Waiting for challenge...";
  }, [challengeState, powState.dots, powState.elapsedMs, powState.status]);

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
            AI agents prove who they are with a cryptographic challenge, receive a JWT, and mint a Solana reputation record on success.
          </p>
        </div>

        <div className="relative mx-auto max-w-md rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-md">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/5 to-transparent" />
          <div className="relative flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">🤖 AI Agent</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                session: {challenge?.challenge_id.slice(0, 8) ?? "loading"}
              </span>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 font-mono text-[11px] leading-relaxed">
              <div className="mb-2 text-muted-foreground"># challenge.json</div>
              <div className="rounded-lg border border-border bg-background/70 p-3 text-foreground">
                <div>
                  <span className="text-muted-foreground">source:</span> {challenge?.source ?? "loading"}
                </div>
                <div className="mt-2">
                  <span className="text-muted-foreground">challenge:</span>
                </div>
                <pre className="mt-1 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-primary">
                  {challenge?.challenge ?? "Loading challenge..."}
                </pre>
                <div className="mt-3 text-success">{powLabel}</div>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <input
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Enter numerical answer"
                  className="w-full rounded-md border border-border bg-background/70 px-3 py-2 text-xs text-foreground outline-none transition-colors focus:border-primary/60"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSolve().catch(() => {})}
                    disabled={powState.status !== "done" || !answer.trim() || submitting}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Solve
                  </button>
                  <button
                    onClick={() => loadChallenge().catch(() => {})}
                    disabled={challengeState === "loading" || submitting}
                    className="inline-flex items-center justify-center rounded-md border border-border bg-background/70 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Load new challenge"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Badge pass={result?.passed === true} label={result ? (result.passed ? "Passed AgentPass" : "Failed AgentPass") : "Awaiting verification"} />
              <Badge pass={powState.status === "done"} label={powState.status === "done" ? "PoW complete" : "PoW pending"} />
              <Badge pass={Boolean(result?.solana?.signature)} label={result?.solana?.signature ? "Solana reputation token issued" : "Solana token pending"} />
            </div>

            {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

            {result?.passed ? (
              <div className="rounded-lg border border-success/30 bg-success/10 p-3">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-success">Solana Reputation</div>
                <p className="mt-2 text-sm text-foreground">
                  This agent passed the reverse CAPTCHA and received an on-chain reputation token for downstream trust and scoring.
                </p>
                <div className="mt-3 space-y-2 font-mono text-[11px] text-muted-foreground">
                  <div>
                    <span className="text-foreground">JWT:</span> {result.token ? "issued" : "not issued"}
                  </div>
                  <div>
                    <span className="text-foreground">signature:</span> {result.solana?.signature ?? "pending"}
                  </div>
                </div>
                {result.solana?.explorer_url ? (
                  <a
                    href={result.solana.explorer_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-xs text-primary underline"
                  >
                    View Solana reputation record
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-lg border border-border bg-background/70 p-3">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">verification.json</div>
              <pre className="overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground">
                {JSON.stringify(result ?? { status: challengeState }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
