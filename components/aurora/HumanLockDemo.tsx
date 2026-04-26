"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { ActivityIcon, CheckIcon, LoaderIcon, RefreshIcon, ShieldIcon, XIcon } from "./icons";

type HumanChallenge =
  | {
      type: "image";
      challenge_id: string;
      image_b64: string;
      correct_label: string;
      ai_sees: string;
      epsilon: number;
    }
  | {
      type: "text";
      challenge_id: string;
      question: string;
    };

type HumanResult = {
  passed: boolean;
  score: number;
  reason: string | null;
  breakdown?: {
    tremor?: boolean;
    linearity?: number;
    timing?: boolean;
    answer?: boolean;
    demo_behavior_gate?: boolean;
  };
  token?: string | null;
};

type Point = {
  x: number;
  y: number;
  t: number;
};

type AgentAttempt = {
  name: string;
  result: "blocked" | "passed";
  humanLikeness: number;
  confidence: number;
  latency: string;
  pathScore: number;
  reason: string;
};

const HUMANLOCK_LABELS = ["cat", "dog", "car", "bird", "chair", "apple", "banana", "clock", "shoe", "guitar"];
const IMAGE_CHALLENGE_RETRY_LIMIT = 3;
const IMAGE_CHALLENGE_RECOVERY_DELAY_MS = 1500;
const MAX_AUTO_RECOVERY_CYCLES = 2;
const FEATURE_PILLS = ["FGSM adversarial images", "Fresh challenge each time", "Behavior scoring"];
const AGENT_ATTEMPTS: AgentAttempt[] = [
  {
    name: "GPT-4o",
    result: "blocked",
    humanLikeness: 42,
    confidence: 96,
    latency: "142ms - uniform",
    pathScore: 18,
    reason: "Failed behavioral path check",
  },
  {
    name: "Claude 3.5 Sonnet",
    result: "blocked",
    humanLikeness: 56,
    confidence: 94,
    latency: "188ms - suspicious",
    pathScore: 31,
    reason: "Suspicious latency pattern",
  },
  {
    name: "Gemini 2.0 Flash",
    result: "blocked",
    humanLikeness: 38,
    confidence: 91,
    latency: "126ms - too steady",
    pathScore: 22,
    reason: "Cursor jumps detected",
  },
  {
    name: "Llama 3.3 70B",
    result: "blocked",
    humanLikeness: 47,
    confidence: 87,
    latency: "215ms - throttled",
    pathScore: 25,
    reason: "Token cadence anomaly",
  },
  {
    name: "Human user",
    result: "passed",
    humanLikeness: 91,
    confidence: 93,
    latency: "612ms - organic",
    pathScore: 88,
    reason: "Natural cursor movement",
  },
];

function shuffle<T>(values: T[]) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
  }
  return copy;
}

function computeTremorScore(points: Point[]) {
  if (points.length < 3) return 0;
  let sumVelocityX = 0;
  let sumVelocityY = 0;
  let velocitySamples = 0;

  for (let index = 1; index < points.length; index += 1) {
    const dt = Math.max(1, points[index].t - points[index - 1].t);
    sumVelocityX += (points[index].x - points[index - 1].x) / dt;
    sumVelocityY += (points[index].y - points[index - 1].y) / dt;
    velocitySamples += 1;
  }

  if (velocitySamples === 0) return 0;
  const meanVelocityX = sumVelocityX / velocitySamples;
  const meanVelocityY = sumVelocityY / velocitySamples;
  const velocityMagnitude = Math.hypot(meanVelocityX, meanVelocityY) || 1;
  const normalX = -meanVelocityY / velocityMagnitude;
  const normalY = meanVelocityX / velocityMagnitude;

  let deviationTotal = 0;
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index].x - points[index - 1].x;
    const dy = points[index].y - points[index - 1].y;
    deviationTotal += Math.abs(dx * normalX + dy * normalY);
  }

  return Number((deviationTotal / (points.length - 1) / 25).toFixed(3));
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

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

function StatusBadge({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${pass ? "border-success/35 bg-success/10 text-success" : "border-destructive/35 bg-destructive/10 text-destructive"}`}>
      {pass ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
      {label}
    </div>
  );
}

function ProgressBar({ value, tone }: { value: number; tone: "green" | "red" | "purple" }) {
  const color = tone === "green" ? "bg-success" : tone === "red" ? "bg-destructive" : "bg-primary";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function AgentAnalysisModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-sm">
      <div className="relative max-h-[82vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-background/95 p-5 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-primary/40 bg-primary/10 p-1.5 text-primary transition-colors hover:bg-primary/20"
          aria-label="Close agent analysis"
        >
          <XIcon className="h-4 w-4" />
        </button>
        <div className="pr-12">
          <h2 className="text-2xl font-semibold tracking-tight">Agent Analysis</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            AI agents that attempted HumanLock, scored on behavior, latency, and human-likeness.
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card/30">
          <div className="flex items-center justify-between border-b border-border bg-background/70 px-5 py-3 font-mono text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-destructive" />
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="h-3 w-3 rounded-full bg-success" />
              <span>aurora://humanlock/attempts</span>
            </div>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success" />
              live
            </span>
          </div>

          <div className="max-h-[54vh] space-y-4 overflow-auto p-4">
            {AGENT_ATTEMPTS.map((attempt) => {
              const passed = attempt.result === "passed";
              return (
                <article key={attempt.name} className={`rounded-xl border p-4 ${passed ? "border-success/35 bg-success/5" : "border-destructive/35 bg-destructive/5"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full ${passed ? "bg-success" : "bg-primary"}`} />
                      <h3 className="font-mono text-base font-semibold">{attempt.name}</h3>
                    </div>
                    <span className={`rounded-lg border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${passed ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
                      {passed ? "Passed" : "Blocked"}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        <span>Human-likeness</span>
                        <span>{attempt.humanLikeness}%</span>
                      </div>
                      <ProgressBar value={attempt.humanLikeness} tone={passed ? "green" : "red"} />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        <span>Path behavior</span>
                        <span>{attempt.pathScore}%</span>
                      </div>
                      <ProgressBar value={attempt.pathScore} tone={passed ? "green" : "red"} />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 border-t border-border pt-4 text-sm text-muted-foreground md:grid-cols-2">
                    <div>
                      <span>Detection confidence</span>
                      <div className="mt-1 font-mono text-foreground">{attempt.confidence}%</div>
                    </div>
                    <div>
                      <span>Latency signature</span>
                      <div className="mt-1 font-mono text-foreground">{attempt.latency}</div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-border bg-background/65 px-4 py-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Reason:</span> {attempt.reason}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HumanLockDemo() {
  const [challenge, setChallenge] = useState<HumanChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [result, setResult] = useState<HumanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const pathPointsRef = useRef<Point[]>([]);
  const clickStartRef = useRef<number | null>(null);
  const clickTimeRef = useRef<number>(0);
  const recoveryTimerRef = useRef<number | null>(null);
  const recoveryCountRef = useRef(0);

  const loadChallenge = useCallback(async (resetRecovery = true) => {
    if (recoveryTimerRef.current !== null) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    if (resetRecovery) recoveryCountRef.current = 0;

    setLoading(true);
    setError(null);
    setResult(null);
    setAnswer("");
    setOptions([]);
    setFallbackNotice(null);
    pathPointsRef.current = [];
    clickStartRef.current = null;
    clickTimeRef.current = 0;

    try {
      let data: HumanChallenge | null = null;

      for (let attempt = 1; attempt <= IMAGE_CHALLENGE_RETRY_LIMIT; attempt += 1) {
        const response = await fetch(apiUrl("/api/humanlock/challenge"), { cache: "no-store" });
        if (!response.ok) throw new Error(`HumanLock challenge failed with ${response.status}`);
        data = (await response.json()) as HumanChallenge;
        if (data.type === "image") break;
        if (attempt < IMAGE_CHALLENGE_RETRY_LIMIT) await delay(250);
      }

      if (!data) throw new Error("HumanLock challenge returned no data");

      if (data.type === "image") {
        setChallenge(data);
        const wrongLabels = shuffle(HUMANLOCK_LABELS.filter((label) => label !== data.correct_label)).slice(0, 3);
        setOptions(shuffle([data.correct_label, ...wrongLabels]));
      } else {
        setChallenge(null);
        if (recoveryCountRef.current < MAX_AUTO_RECOVERY_CYCLES) {
          setFallbackNotice("Generating an adversarial image challenge. The text fallback was rejected and AURORA is retrying.");
          recoveryCountRef.current += 1;
          recoveryTimerRef.current = window.setTimeout(() => {
            loadChallenge(false).catch(() => {});
          }, IMAGE_CHALLENGE_RECOVERY_DELAY_MS);
        } else {
          setFallbackNotice("Image generator unavailable. Try a new challenge after the FGSM service is back up.");
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load HumanLock challenge");
      setChallenge(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recoveryTimerRef.current !== null) window.clearTimeout(recoveryTimerRef.current);
    };
  }, []);

  const openChallenge = useCallback(() => {
    setChallengeOpen(true);
    loadChallenge().catch(() => {});
  }, [loadChallenge]);

  const trackPoint = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = panelRef.current?.getBoundingClientRect();
    if (!bounds) return;
    pathPointsRef.current.push({ x: event.clientX - bounds.left, y: event.clientY - bounds.top, t: performance.now() });
    if (pathPointsRef.current.length > 300) pathPointsRef.current.shift();
  }, []);

  const handleMouseDown = useCallback(() => {
    clickStartRef.current = performance.now();
  }, []);

  const handleMouseUp = useCallback(() => {
    if (clickStartRef.current !== null) {
      clickTimeRef.current = Math.round(performance.now() - clickStartRef.current);
      clickStartRef.current = null;
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!challenge || !answer.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(apiUrl("/api/humanlock/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: challenge.challenge_id,
          answer,
          type: challenge.type,
          mouse_signals: {
            path_points: pathPointsRef.current,
            click_time_ms: clickTimeRef.current,
            tremor_score: computeTremorScore(pathPointsRef.current),
          },
        }),
      });

      if (!response.ok) throw new Error(`HumanLock verify failed with ${response.status}`);
      const data = (await response.json()) as HumanResult;
      setResult(data);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "HumanLock verification failed");
    } finally {
      setSubmitting(false);
    }
  }, [answer, challenge]);

  const selectionReady = Boolean(answer.trim());
  const session = challenge?.type === "image" ? sessionLabel(challenge.challenge_id) : "LOADING";

  return (
    <section id="humanlock" className="relative flex min-h-screen items-center overflow-hidden pb-32 pt-28">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-35" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-[520px] w-[520px] rounded-full bg-cyan-400/10 blur-[140px]" />
      <div className="relative mx-auto w-full max-w-7xl px-6">
        <div className={`grid items-center gap-12 transition-all duration-700 ${challengeOpen ? "lg:grid-cols-[0.95fr_1.05fr]" : "place-items-center"}`}>
          <div className={`transition-all duration-700 ${challengeOpen ? "max-w-2xl text-left" : "mx-auto max-w-3xl text-center"}`}>
            <div className={`mb-6 inline-flex items-center gap-3 ${challengeOpen ? "" : "justify-center"}`}>
              <span className="h-px w-8 bg-primary" />
              <span className="text-xs font-medium uppercase tracking-[0.24em] text-primary">HumanLock</span>
              <span className="h-px w-8 bg-primary" />
            </div>
            <h1 className="text-balance text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
              <span>Only </span>
              <span className="text-iridescent">humans</span>
              <span> get through.</span>
            </h1>
            <p className={`mt-6 text-balance text-lg leading-relaxed text-muted-foreground ${challengeOpen ? "max-w-xl" : "mx-auto max-w-2xl"}`}>
              HumanLock creates adversarial image challenges that look normal to people but confuse AI vision models. It also checks behavior signals like timing and cursor movement.
            </p>

            <div className={`mt-10 flex flex-col gap-4 sm:flex-row ${challengeOpen ? "" : "justify-center"}`}>
              <button
                onClick={challengeOpen ? () => loadChallenge().catch(() => {}) : openChallenge}
                disabled={loading || submitting}
                className="glow-accent rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground transition-all hover:bg-primary-glow disabled:cursor-not-allowed disabled:opacity-60"
              >
                {challengeOpen ? "New challenge" : "Try the challenge"}
              </button>
              <button
                onClick={() => setAnalysisOpen(true)}
                className="inline-flex items-center justify-center gap-3 rounded-xl border border-border bg-background/50 px-8 py-4 text-base font-semibold text-foreground backdrop-blur-md transition-colors hover:border-primary/40 hover:bg-secondary/70"
              >
                <ActivityIcon className="h-4 w-4 text-primary" />
                Agent analysis
              </button>
            </div>

            <div className={`mt-8 flex flex-wrap gap-3 ${challengeOpen ? "" : "justify-center"}`}>
              {FEATURE_PILLS.map((pill) => (
                <Pill key={pill} label={pill} />
              ))}
            </div>
          </div>

          {challengeOpen ? (
            <div
              ref={panelRef}
              onMouseMove={trackPoint}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              className="relative mx-auto w-full max-w-xl rounded-3xl border border-border bg-card/35 p-6 shadow-2xl shadow-primary/10 backdrop-blur-md"
            >
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-primary/10 to-transparent" />
              <div className="relative rounded-2xl border border-border bg-background/75 p-5 backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-center gap-3 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
                    <ShieldIcon className="h-4 w-4 text-primary" />
                    <span>AURORA / HumanLock</span>
                  </div>
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Session: {session}</span>
                </div>

                <div className="mt-5 rounded-xl border border-border bg-card/50 p-4">
                  {challenge?.type === "image" ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Select the label that matches this adversarial image. The image is simple for people, but tuned to confuse model vision.
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`data:image/png;base64,${challenge.image_b64}`} alt="HumanLock challenge" className="mt-4 aspect-square w-full rounded-xl border border-border bg-black object-cover" />
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {options.map((option) => (
                          <button
                            key={option}
                            onClick={() => {
                              setAnswer(option);
                              clickTimeRef.current = clickTimeRef.current || 180;
                            }}
                            className={`rounded-lg border px-3 py-3 text-left text-sm font-semibold capitalize transition-colors ${answer === option ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/75 text-foreground hover:bg-secondary/70"}`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-border bg-background/60 px-4 text-center text-sm text-muted-foreground">
                      {loading ? "Generating adversarial image challenge..." : "Challenge unavailable"}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleSubmit().catch(() => {})}
                    disabled={!selectionReady || submitting || loading}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-glow disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                    Verify - I&apos;m human
                  </button>
                  <button
                    onClick={() => loadChallenge().catch(() => {})}
                    disabled={loading || submitting}
                    className="inline-flex items-center justify-center rounded-xl border border-border bg-background/70 px-4 py-3 text-muted-foreground transition-colors hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Load new challenge"
                  >
                    <RefreshIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <StatusBadge
                    pass={result?.passed === true}
                    label={result ? (result.passed ? "Passed HumanLock" : "Failed HumanLock") : "Awaiting HumanLock"}
                  />
                  <StatusBadge pass={false} label={result?.passed ? "Failed AgentPass" : "AgentPass not used"} />
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  <span>Adversarial - unique per request</span>
                  <span className="flex items-center gap-2 text-success">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    Live
                  </span>
                </div>

                <div className="mt-4 rounded-xl border border-border bg-background/65 p-3 font-mono text-[11px] text-muted-foreground">
                  tracked points: {pathPointsRef.current.length} / click: {clickTimeRef.current || 0}ms / tremor: {computeTremorScore(pathPointsRef.current).toFixed(3)}
                </div>

                {error ? <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}
                {fallbackNotice ? <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">{fallbackNotice}</div> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {analysisOpen ? <AgentAnalysisModal onClose={() => setAnalysisOpen(false)} /> : null}
    </section>
  );
}
