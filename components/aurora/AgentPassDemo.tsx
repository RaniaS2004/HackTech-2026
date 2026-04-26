"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { CheckIcon, KeyIcon, LoaderIcon, XIcon } from "./icons";

type AgentChallenge = {
  challenge_id: string;
  challenge: string;
  problem: string;
  answer: string;
  unit: string;
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

const FEATURE_PILLS = ["SHA-256 proof-of-work", "Signed JWT", "Solana devnet memo"];

function sessionLabel(id?: string) {
  return id ? id.replace(/-/g, "").slice(0, 8).toUpperCase() : "LOADING";
}

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {label}
    </span>
  );
}

function StatusBadge({ pass, label, pending = false }: { pass: boolean; label: string; pending?: boolean }) {
  const classes = pending
    ? "border-yellow-500/35 bg-yellow-500/10 text-yellow-200"
    : pass
      ? "border-success/35 bg-success/10 text-success"
      : "border-border bg-background/65 text-muted-foreground";

  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${classes}`}>
      <span>{label}</span>
      {pending ? <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> : pass ? <CheckIcon className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />}
    </div>
  );
}

function TokenFlowModal({ result, onClose }: { result: AgentPassResult | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-background/95 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-primary/40 bg-primary/10 p-1.5 text-primary transition-colors hover:bg-primary/20"
          aria-label="Close token flow"
        >
          <XIcon className="h-4 w-4" />
        </button>
        <h2 className="pr-12 text-2xl font-semibold tracking-tight">AgentPass Token Flow</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A trusted agent solves the challenge, completes proof-of-work, receives a signed token, and can write a reputation memo to Solana devnet.
        </p>

        <div className="mt-6 grid gap-3">
          {["Challenge issued", "Proof-of-work complete", "Answer verified", "JWT signed", "Solana memo written when credentials are available"].map((step, index) => (
            <div key={step} className="flex items-center gap-3 rounded-xl border border-border bg-card/35 p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/35 bg-primary/10 font-mono text-xs text-primary">{index + 1}</span>
              <span className="text-sm font-medium text-foreground">{step}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-border bg-background/70 p-4">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">token preview</div>
          <pre className="max-h-44 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground">
            {result?.token
              ? result.token
              : "Token appears here after an agent passes AgentPass."}
          </pre>
          {result?.solana?.explorer_url ? (
            <a href={result.solana.explorer_url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium text-primary underline">
              View Solana reputation memo
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AgentPassDemo() {
  const [challenge, setChallenge] = useState<AgentChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [challengeState, setChallengeState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [powState, setPowState] = useState<{ status: "idle" | "running" | "done"; elapsedMs?: number; dots: string }>({ status: "idle", dots: "" });
  const [result, setResult] = useState<AgentPassResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [tokenFlowOpen, setTokenFlowOpen] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const challengeLoadedAtRef = useRef<number>(0);

  const startPow = useCallback((challengeId: string) => {
    workerRef.current?.terminate();
    const worker = new Worker("/pow-worker.js");
    workerRef.current = worker;
    setPowState({ status: "running", dots: "" });

    worker.onmessage = (event: MessageEvent<PowWorkerResult>) => {
      const elapsedMs = Number(event.data?.elapsed_ms);
      setPowState({ status: "done", elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : 0, dots: "" });
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
      setPowState((current) => ({ ...current, dots: current.dots.length >= 3 ? "" : `${current.dots}.` }));
    }, 400);
    return () => window.clearInterval(timer);
  }, [powState.status]);

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

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
      if (!response.ok) throw new Error(`AgentPass challenge failed with ${response.status}`);
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

  const openChallenge = useCallback(() => {
    setChallengeOpen(true);
    loadChallenge().catch(() => {});
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

      if (!response.ok) throw new Error(`AgentPass verify failed with ${response.status}`);
      const data = (await response.json()) as AgentPassResult;
      setResult(data);
    } catch (solveError) {
      setError(solveError instanceof Error ? solveError.message : "AgentPass verification failed");
    } finally {
      setSubmitting(false);
    }
  }, [answer, challenge, powState.elapsedMs, powState.status]);

  const powLabel = useMemo(() => {
    if (challengeState === "idle") return "Waiting for challenge";
    if (challengeState === "loading") return "Waiting for challenge";
    if (challengeState === "error") return "Proof-of-work unavailable";
    if (powState.status === "running") return `Computing proof-of-work${powState.dots}`;
    if (powState.status === "done") return `PoW solved in ${powState.elapsedMs}ms`;
    return "Waiting for challenge";
  }, [challengeState, powState.dots, powState.elapsedMs, powState.status]);

  const session = sessionLabel(challenge?.challenge_id);
  const solanaPending = result?.passed === true && !result.solana?.signature;

  return (
    <section id="agentpass" className="relative flex min-h-screen items-center overflow-hidden pb-32 pt-28">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-35" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-[520px] w-[520px] rounded-full bg-primary/10 blur-[140px]" />
      <div className="relative mx-auto w-full max-w-7xl px-6">
        <div className={`grid items-center gap-12 transition-all duration-700 ${challengeOpen ? "lg:grid-cols-[0.95fr_1.05fr]" : "place-items-center"}`}>
          <div className={`transition-all duration-700 ${challengeOpen ? "max-w-2xl text-left" : "mx-auto max-w-4xl text-center"}`}>
            <div className={`mb-6 inline-flex items-center gap-3 ${challengeOpen ? "" : "justify-center"}`}>
              <span className="h-px w-8 bg-primary" />
              <span className="text-xs font-medium uppercase tracking-[0.24em] text-primary">AgentPass</span>
              <span className="h-px w-8 bg-primary" />
            </div>
            <h1 className="text-balance text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
              <span>Trusted </span>
              <span className="text-iridescent">agents</span>
              <span> get verified.</span>
            </h1>
            <p className={`mt-6 text-balance text-lg leading-relaxed text-muted-foreground ${challengeOpen ? "max-w-xl" : "mx-auto max-w-3xl"}`}>
              AgentPass gives legitimate AI agents a way to prove themselves. They solve an obfuscated challenge, complete proof-of-work, and receive a signed identity token.
            </p>

            <div className={`mt-10 flex flex-col gap-4 sm:flex-row ${challengeOpen ? "" : "justify-center"}`}>
              <button
                onClick={challengeOpen ? () => loadChallenge().catch(() => {}) : openChallenge}
                disabled={challengeState === "loading" || submitting}
                className="glow-accent rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground transition-all hover:bg-primary-glow disabled:cursor-not-allowed disabled:opacity-60"
              >
                {challengeOpen ? "New AgentPass" : "Run AgentPass"}
              </button>
              <button
                onClick={() => setTokenFlowOpen(true)}
                className="inline-flex items-center justify-center gap-3 rounded-xl border border-border bg-background/50 px-8 py-4 text-base font-semibold text-foreground backdrop-blur-md transition-colors hover:border-primary/40 hover:bg-secondary/70"
              >
                <KeyIcon className="h-4 w-4 text-primary" />
                View token flow
              </button>
            </div>

            <div className={`mt-8 flex flex-wrap gap-3 ${challengeOpen ? "" : "justify-center"}`}>
              {FEATURE_PILLS.map((pill) => (
                <Pill key={pill} label={pill} />
              ))}
            </div>
          </div>

          {challengeOpen ? (
            <div className="relative mx-auto w-full max-w-xl rounded-3xl border border-border bg-card/35 p-6 shadow-2xl shadow-primary/10 backdrop-blur-md">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-primary/10 to-transparent" />
              <div className="relative rounded-2xl border border-border bg-background/75 p-5 backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-center gap-3 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
                    <KeyIcon className="h-4 w-4 text-primary" />
                    <span>AURORA / AgentPass</span>
                  </div>
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Session: {session}</span>
                </div>

                <div className="mt-5 rounded-xl border border-border bg-card/50 p-4 font-mono text-[12px] leading-relaxed">
                  <div className="text-muted-foreground"># challenge.obf</div>
                  <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-primary">
                    {challenge?.challenge ?? "Loading obfuscated challenge..."}
                  </pre>
                  <div className="mt-4 rounded-lg border border-border bg-background/70 p-3 text-muted-foreground">
                    <span className="text-foreground">plain:</span> {challenge?.problem ?? "Waiting for challenge..."}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-border bg-background/70 px-4 py-3 font-mono text-xs text-muted-foreground">
                  <div className="flex items-center justify-between gap-3">
                    <span className="uppercase tracking-[0.18em]">Proof-of-work</span>
                    <span className={powState.status === "done" ? "text-success" : "text-primary"}>{powLabel}</span>
                  </div>
                </div>

                <label className="mt-5 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground" htmlFor="agentpass-answer">
                  Answer
                </label>
                <input
                  id="agentpass-answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Enter numerical answer"
                  className="mt-2 w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary/60"
                />

                <button
                  onClick={() => handleSolve().catch(() => {})}
                  disabled={powState.status !== "done" || !answer.trim() || submitting}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-glow disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                  Verify agent
                </button>

                <div className="mt-5 grid gap-3">
                  <StatusBadge pass={powState.status === "done"} label="PoW complete" />
                  <StatusBadge pass={result?.passed === true} label={result?.passed ? "Agent token issued" : "Agent token pending"} />
                  <StatusBadge
                    pass={Boolean(result?.solana?.signature)}
                    pending={solanaPending}
                    label={result?.solana?.signature ? "Solana memo issued" : "Solana memo pending"}
                  />
                </div>

                {result?.passed ? (
                  <div className="mt-5 rounded-xl border border-success/30 bg-success/10 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-success">verification</div>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <div>
                        <span>model</span>
                        <div className="font-mono text-foreground">{result.fingerprint?.model ?? "unknown"}</div>
                      </div>
                      <div>
                        <span>confidence</span>
                        <div className="font-mono text-foreground">{result.fingerprint ? `${Math.round(result.fingerprint.confidence * 100)}%` : "pending"}</div>
                      </div>
                    </div>
                    <pre className="mt-4 max-h-24 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background/65 p-3 font-mono text-[11px] text-foreground">
                      {result.token ?? "token pending"}
                    </pre>
                  </div>
                ) : null}

                {error ? <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {tokenFlowOpen ? <TokenFlowModal result={result} onClose={() => setTokenFlowOpen(false)} /> : null}
    </section>
  );
}
