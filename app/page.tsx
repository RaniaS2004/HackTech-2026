"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type AgentChallenge = {
  challenge_id: string;
  challenge: string;
  expires_at: number;
};

type PowWorkerResult = {
  nonce: number;
  hash: string;
  elapsed_ms: number;
};

type Point = {
  x: number;
  y: number;
  t: number;
};

type IdentityState = {
  human: {
    passed: boolean;
    score?: number;
    breakdown?: object;
    token?: string | null;
  } | null;
  agent: {
    passed: boolean;
    fingerprint?: {
      model: string;
      confidence: number;
      latency_ms: number;
      pow_ms: number;
    };
    solana?: {
      signature: string;
      explorer_url: string;
    };
    token?: string | null;
    reason?: string;
  } | null;
};

const HUMANLOCK_LABELS = ["cat", "dog", "car", "bird", "chair", "apple", "banana", "clock", "shoe", "guitar"];

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

function HumanLockPanel({ onResult }: { onResult: (value: IdentityState["human"]) => void }) {
  const [challenge, setChallenge] = useState<HumanChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "pass" | "fail">("idle");
  const [details, setDetails] = useState<{ score?: number; breakdown?: object; token?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const pathPointsRef = useRef<Point[]>([]);
  const clickStartRef = useRef<number | null>(null);
  const clickTimeRef = useRef<number>(0);

  const buildImageOptions = useCallback((correctLabel: string) => {
    const wrongLabels = shuffle(HUMANLOCK_LABELS.filter((label) => label !== correctLabel)).slice(0, 3);
    return shuffle([correctLabel, ...wrongLabels]);
  }, []);

  const loadChallenge = useCallback(async () => {
    setStatus("idle");
    setAnswer("");
    setDetails(null);
    setError(null);
    pathPointsRef.current = [];
    clickStartRef.current = null;
    clickTimeRef.current = 0;

    const response = await fetch("/api/humanlock/challenge", { cache: "no-store" });
    const data = (await response.json()) as HumanChallenge;
    setChallenge(data);
    setOptions(data.type === "image" ? buildImageOptions(data.correct_label) : []);
  }, [buildImageOptions]);

  useEffect(() => {
    loadChallenge().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load challenge"));
  }, [loadChallenge]);

  const trackPoint = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = panelRef.current?.getBoundingClientRect();
    if (!bounds) return;
    pathPointsRef.current.push({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      t: performance.now(),
    });
    if (pathPointsRef.current.length > 300) {
      pathPointsRef.current.shift();
    }
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
    setStatus("loading");

    const tremorScore = computeTremorScore(pathPointsRef.current);
    const response = await fetch("/api/humanlock/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge_id: challenge.challenge_id,
        answer,
        type: challenge.type,
        mouse_signals: {
          path_points: pathPointsRef.current,
          click_time_ms: clickTimeRef.current,
          tremor_score: tremorScore,
        },
      }),
    });

    const data = (await response.json()) as {
      passed: boolean;
      score: number;
      breakdown: object;
      token: string | null;
    };

    setStatus(data.passed ? "pass" : "fail");
    setDetails({ score: data.score, breakdown: data.breakdown, token: data.token });
    onResult({
      passed: data.passed,
      score: data.score,
      breakdown: data.breakdown,
      token: data.token,
    });
  }, [answer, challenge, onResult]);

  return (
    <div
      ref={panelRef}
      onMouseMove={trackPoint}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className="flex-1 rounded-2xl border border-orange-500/40 bg-[#0f0f0f] p-6 flex flex-col gap-4"
    >
      <div>
        <p className="text-orange-400 text-xs uppercase tracking-[0.25em]">HumanLock</p>
        <h2 className="text-xl text-orange-100">Adversarial human verification</h2>
      </div>

      {challenge?.type === "image" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-300">What do you see?</p>
          <img
            src={`data:image/png;base64,${challenge.image_b64}`}
            alt="HumanLock challenge"
            width={280}
            height={280}
            className="w-[280px] max-w-full rounded-xl border border-zinc-800 bg-black"
          />
          <p className="text-xs text-zinc-500">
            AI sees: {challenge.ai_sees} - ε={challenge.epsilon.toFixed(4)}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  setAnswer(option);
                  clickTimeRef.current = clickTimeRef.current || 180;
                }}
                className={`rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                  answer === option
                    ? "border-orange-400 bg-orange-500/15 text-orange-100"
                    : "border-zinc-700 bg-black text-zinc-300 hover:border-orange-500/50"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : challenge?.type === "text" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-300">{challenge.question}</p>
          <input
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Describe your answer"
            className="rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-200 outline-none focus:border-orange-500/70"
          />
        </div>
      ) : (
        <div className="text-sm text-zinc-500">Loading HumanLock...</div>
      )}

      <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-xs text-zinc-500">
        {pathPointsRef.current.length} tracked points · click {clickTimeRef.current || 0}ms · tremor{" "}
        {computeTremorScore(pathPointsRef.current).toFixed(3)}
      </div>

      <button
        onClick={() => handleSubmit().catch((submitError) => setError(submitError instanceof Error ? submitError.message : "Verification failed"))}
        disabled={!challenge || !answer || status === "loading"}
        className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-300 disabled:opacity-40 cursor-pointer"
      >
        {status === "loading" ? "Verifying..." : "Submit"}
      </button>

      {details && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            status === "pass"
              ? "border-green-500/40 bg-green-500/10 text-green-300"
              : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          {status === "pass" ? "Human verified" : "Behavioral score too bot-like"} · score {details.score}
        </div>
      )}

      {error && <div className="text-xs text-red-400">{error}</div>}

      <button onClick={() => loadChallenge().catch(console.error)} className="text-left text-xs text-zinc-500 underline cursor-pointer">
        New HumanLock challenge
      </button>
    </div>
  );
}

function AgentPassPanel({ onResult }: { onResult: (value: IdentityState["agent"]) => void }) {
  const [challenge, setChallenge] = useState<AgentChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [challengeState, setChallengeState] = useState<"loading" | "ready" | "error">("loading");
  const [powState, setPowState] = useState<{ status: "idle" | "running" | "done"; elapsedMs?: number; dots: string }>({
    status: "idle",
    dots: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "pass" | "fail">("idle");
  const [details, setDetails] = useState<IdentityState["agent"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingCursorVisible, setLoadingCursorVisible] = useState(true);

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

  useEffect(() => {
    if (challengeState !== "loading") return;
    const timer = window.setInterval(() => {
      setLoadingCursorVisible((current) => !current);
    }, 450);
    return () => window.clearInterval(timer);
  }, [challengeState]);

  const loadChallenge = useCallback(async () => {
    workerRef.current?.terminate();
    setStatus("idle");
    setAnswer("");
    setChallenge(null);
    setChallengeState("loading");
    setDetails(null);
    setError(null);
    setPowState({ status: "idle", dots: "" });
    setLoadingCursorVisible(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 180_000);

    try {
      const response = await fetch("/api/agentpass/challenge", {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Challenge request failed with ${response.status}`);
      }

      const data = (await response.json()) as AgentChallenge;
      setChallenge(data);
      setChallengeState("ready");
      challengeLoadedAtRef.current = performance.now();
      startPow(data.challenge_id);
    } catch (loadError) {
      setChallengeState("error");
      setError(loadError instanceof DOMException && loadError.name === "AbortError" ? "K2 Think V2 took more than 3 minutes." : "Failed to load agent challenge");
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [startPow]);

  useEffect(() => {
    loadChallenge().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load agent challenge"));
    return () => workerRef.current?.terminate();
  }, [loadChallenge]);

  const handleSubmit = useCallback(async () => {
    if (!challenge || !answer.trim() || powState.status !== "done") return;
    setStatus("loading");

    const responseLatencyMs = Math.round(performance.now() - challengeLoadedAtRef.current);
    const response = await fetch("/api/agentpass/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge_id: challenge.challenge_id,
        answer,
        response_latency_ms: responseLatencyMs,
        pow_time_ms: powState.elapsedMs ?? 0,
      }),
    });

    const data = (await response.json()) as {
      passed: boolean;
      reason?: string;
      fingerprint?: {
        model: string;
        confidence: number;
        latency_ms: number;
        pow_ms: number;
      };
      solana?: {
        signature: string;
        explorer_url: string;
      };
      token?: string | null;
    };

    if (data.passed) {
      setStatus("pass");
      const next = {
        passed: true,
        fingerprint: data.fingerprint,
        solana: data.solana,
        token: data.token ?? null,
      };
      setDetails(next);
      onResult(next);
    } else {
      setStatus("fail");
      const next = {
        passed: false,
        reason: data.reason,
        token: data.token ?? null,
      };
      setDetails(next);
      onResult(next);
    }
  }, [answer, challenge, onResult, powState.elapsedMs, powState.status]);

  const challengeLoaded = challengeState === "ready" && challenge !== null;
  const powComplete = powState.status === "done";
  const canSolve = challengeLoaded && powComplete && !!answer.trim() && status !== "loading";

  const powLabel = useMemo(() => {
    if (challengeState === "loading") {
      return "Waiting for challenge...";
    }
    if (challengeState === "error") {
      return "Proof-of-work unavailable until challenge loads.";
    }
    if (powState.status === "running") {
      return `Computing proof-of-work${powState.dots}`;
    }
    if (powState.status === "done") {
      return `PoW solved in ${powState.elapsedMs}ms`;
    }
    return "Waiting for challenge...";
  }, [challengeState, powState.dots, powState.elapsedMs, powState.status]);

  return (
    <div className="flex-1 rounded-2xl border border-cyan-500/40 bg-[#0f0f0f] p-6 flex flex-col gap-4">
      <div>
        <p className="text-cyan-400 text-xs uppercase tracking-[0.25em]">AgentPass</p>
        <h2 className="text-xl text-cyan-100">Machine-native challenge gate</h2>
      </div>

      <div className="rounded-xl border border-cyan-500/20 bg-black/40 p-4">
        {challengeState === "loading" ? (
          <p className="text-sm leading-relaxed text-cyan-100 break-words">
            Generating challenge via K2 Think V2{loadingCursorVisible ? "_" : " "}
          </p>
        ) : challengeState === "error" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-red-300">{error ?? "Failed to load challenge."}</p>
            <button
              onClick={() => loadChallenge().catch(console.error)}
              className="w-fit rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-300 cursor-pointer"
            >
              Retry challenge
            </button>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-cyan-100 break-words">{challenge?.challenge}</p>
        )}
        <p className="mt-2 text-xs text-zinc-500">challenge encoded for machine parsing</p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-xs text-zinc-500">{powLabel}</div>

      <div className="flex flex-col gap-2">
        <input
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Machine response"
          className="rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500/70"
        />
        <button
          onClick={() => handleSubmit().catch((submitError) => setError(submitError instanceof Error ? submitError.message : "Verification failed"))}
          disabled={!canSolve}
          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300 disabled:opacity-40 cursor-pointer"
        >
          {status === "loading" ? "Verifying..." : "Solve"}
        </button>
      </div>

      {details && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            details.passed ? "border-green-500/40 bg-green-500/10 text-green-300" : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          {details.passed
            ? `Verified as ${details.fingerprint?.model} (${Math.round((details.fingerprint?.confidence ?? 0) * 100)}% confidence)`
            : `Verification failed: ${details.reason}`}
          {details.passed && details.solana ? (
            <div className="mt-3">
              <a
                href={details.solana.explorer_url}
                target="_blank"
                rel="noreferrer"
                className="text-[#9945FF] underline"
              >
                View on Solana
              </a>
            </div>
          ) : null}
        </div>
      )}

      {error && <div className="text-xs text-red-400">{error}</div>}

      <button onClick={() => loadChallenge().catch(console.error)} className="text-left text-xs text-zinc-500 underline cursor-pointer">
        New AgentPass challenge
      </button>
    </div>
  );
}

function IdentityReadout({ state }: { state: IdentityState }) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-700/40 bg-[#0f0f0f] p-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">JANUS Identity Readout</p>
      <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap break-all text-xs leading-relaxed text-cyan-200/80">
        {JSON.stringify(state, null, 2)}
      </pre>
    </div>
  );
}

export default function Home() {
  const [identityState, setIdentityState] = useState<IdentityState>({
    human: null,
    agent: null,
  });

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-12 font-mono text-zinc-100">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-[0.28em] text-white">JANUS</h1>
          <p className="mt-3 text-sm uppercase tracking-[0.24em] text-zinc-500">Dual-sided identity layer for the agentic web</p>
        </div>

        <div className="flex w-full flex-col gap-6 xl:flex-row xl:items-stretch">
          <HumanLockPanel onResult={(human) => setIdentityState((current) => ({ ...current, human }))} />
          <div className="flex shrink-0 items-center justify-center">
            <IdentityReadout state={identityState} />
          </div>
          <AgentPassPanel onResult={(agent) => setIdentityState((current) => ({ ...current, agent }))} />
        </div>
      </div>
    </main>
  );
}
