"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { CheckIcon, LoaderIcon, RefreshIcon, XIcon } from "./icons";

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

const HUMANLOCK_LABELS = ["cat", "dog", "car", "bird", "chair", "apple", "banana", "clock", "shoe", "guitar"];
const IMAGE_CHALLENGE_RETRY_LIMIT = 3;
const IMAGE_CHALLENGE_RECOVERY_DELAY_MS = 1500;
const MAX_AUTO_RECOVERY_CYCLES = 2;

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

function Badge({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium ${pass ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
      {pass ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
      {label}
    </div>
  );
}

export function HumanLockDemo() {
  const [challenge, setChallenge] = useState<HumanChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [result, setResult] = useState<HumanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

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
          setFallbackNotice("Generating adversarial image challenge. Text fallback was rejected and the app is retrying automatically.");
          recoveryCountRef.current += 1;
          recoveryTimerRef.current = window.setTimeout(() => {
            loadChallenge(false).catch(() => {});
          }, IMAGE_CHALLENGE_RECOVERY_DELAY_MS);
        } else {
          setFallbackNotice("Image generator unavailable. Click New challenge to retry after the FGSM service is back up.");
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
    loadChallenge().catch(() => {});
    return () => {
      if (recoveryTimerRef.current !== null) window.clearTimeout(recoveryTimerRef.current);
    };
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

  return (
    <section id="humanlock" className="relative py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <div className="mb-3 inline-flex items-center gap-2">
            <span className="h-px w-6 bg-primary" />
            <span className="text-xs font-medium uppercase tracking-widest text-primary">HumanLock</span>
            <span className="h-px w-6 bg-primary" />
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Challenges that only humans can solve.</h2>
          <p className="mt-4 text-muted-foreground">Adversarial visual puzzles that defeat modern AI vision models.</p>
        </div>

        <div ref={panelRef} onMouseMove={trackPoint} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} className="relative mx-auto max-w-md rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-md">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/5 to-transparent" />
          <div className="relative flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">👤 Human</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">session: {challenge?.challenge_id.slice(0, 8) ?? "loading"}</span>
            </div>

            <div className="rounded-lg border border-border bg-card p-3">
              {challenge?.type === "image" ? (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">Select the correct label for this adversarial image challenge.</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`data:image/png;base64,${challenge.image_b64}`} alt="HumanLock challenge" className="w-full rounded-xl border border-border bg-black object-cover" />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {options.map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          setAnswer(option);
                          clickTimeRef.current = clickTimeRef.current || 180;
                        }}
                        className={`rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors ${answer === option ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-background/70 text-foreground hover:bg-secondary/70"}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-background/60 px-4 py-10 text-sm text-muted-foreground">
                  {loading ? "Generating adversarial image challenge..." : "Challenge unavailable"}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleSubmit().catch(() => {})}
                  disabled={!selectionReady || submitting || loading}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> : null}
                  Verify
                </button>
                <button
                  onClick={() => loadChallenge().catch(() => {})}
                  disabled={loading || submitting}
                  className="inline-flex items-center justify-center rounded-md border border-border bg-background/70 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Load new challenge"
                >
                  <RefreshIcon className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                onClick={() => loadChallenge().catch(() => {})}
                disabled={loading || submitting}
                className="mt-2 w-full rounded-md border border-border bg-background/70 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                New challenge
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <Badge pass={result?.passed === true} label={result ? (result.passed ? "Passed HumanLock" : "Failed HumanLock") : "Awaiting verification"} />
              <Badge pass={selectionReady} label={challenge?.type === "image" ? "Image challenge loaded" : loading ? "Image challenge loading" : "Challenge unavailable"} />
            </div>

            <div className="rounded-lg border border-border bg-background/70 p-3 font-mono text-[11px] text-muted-foreground">
              tracked points: {pathPointsRef.current.length} · click: {clickTimeRef.current || 0}ms · tremor: {computeTremorScore(pathPointsRef.current).toFixed(3)}
            </div>

            {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}
            {fallbackNotice ? <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">{fallbackNotice}</div> : null}

            <div className="rounded-lg border border-border bg-background/70 p-3">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">verification.json</div>
              <pre className="overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground">
                {JSON.stringify(result ?? { status: loading ? "loading" : "ready" }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
