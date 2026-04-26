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
  problem: string;
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

function HumanLockSection() {
  const [challenge, setChallenge] = useState<HumanChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [result, setResult] = useState<string>('{"status":"loading"}');
  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const pathPointsRef = useRef<Point[]>([]);
  const clickStartRef = useRef<number | null>(null);
  const clickTimeRef = useRef<number>(0);

  const loadChallenge = useCallback(async () => {
    setAnswer("");
    setError(null);
    setResult('{"status":"loading"}');
    pathPointsRef.current = [];
    clickStartRef.current = null;
    clickTimeRef.current = 0;

    const response = await fetch("/api/humanlock/challenge", { cache: "no-store" });
    const data = (await response.json()) as HumanChallenge;
    setChallenge(data);
    if (data.type === "image") {
      const wrongLabels = shuffle(HUMANLOCK_LABELS.filter((label) => label !== data.correct_label)).slice(0, 3);
      setOptions(shuffle([data.correct_label, ...wrongLabels]));
    } else {
      setOptions([]);
    }
  }, []);

  useEffect(() => {
    loadChallenge().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load HumanLock challenge"));
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
          tremor_score: computeTremorScore(pathPointsRef.current),
        },
      }),
    });

    const data = await response.json();
    setResult(JSON.stringify(data, null, 2));
  }, [answer, challenge]);

  return (
    <section
      ref={panelRef}
      onMouseMove={trackPoint}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className="rounded-2xl border border-orange-500/40 bg-[#111111] p-6"
    >
      <h1 className="text-3xl font-bold uppercase tracking-[0.18em] text-orange-200">HUMANLOCK CHALLENGE — Prove you are human</h1>
      <p className="mt-6 text-sm text-zinc-300">What do you see?</p>

      {challenge?.type === "image" ? (
        <div className="mt-4 flex flex-col gap-4">
          <img
            id="humanlock-image"
            src={`data:image/png;base64,${challenge.image_b64}`}
            alt={`HumanLock challenge image. The correct label is ${challenge.correct_label}.`}
            className="w-full max-w-md rounded-xl border border-zinc-800 bg-black"
          />

          <div className="grid max-w-md grid-cols-2 gap-3">
            {options.map((option) => (
              <button
                key={option}
                id={`choice-${option}`}
                onClick={() => {
                  setAnswer(option);
                  clickTimeRef.current = clickTimeRef.current || 180;
                }}
                className={`rounded-lg border px-4 py-3 text-left text-sm cursor-pointer ${
                  answer === option
                    ? "border-orange-400 bg-orange-500/15 text-orange-100"
                    : "border-zinc-700 bg-black text-zinc-300"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : challenge?.type === "text" ? (
        <div className="mt-4 text-sm text-zinc-300">{challenge.question}</div>
      ) : (
        <div className="mt-4 text-sm text-zinc-500">Loading image challenge...</div>
      )}

      <div className="mt-4 text-xs text-zinc-500">
        {pathPointsRef.current.length} tracked points · click {clickTimeRef.current || 0}ms · tremor {computeTremorScore(pathPointsRef.current).toFixed(3)}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          id="humanlock-submit"
          onClick={() => handleSubmit().catch((submitError) => setError(submitError instanceof Error ? submitError.message : "HumanLock verify failed"))}
          className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-300 cursor-pointer"
        >
          Submit
        </button>
        <button onClick={() => loadChallenge().catch(console.error)} className="text-xs text-zinc-500 underline cursor-pointer">
          New challenge
        </button>
      </div>

      {error ? <div className="mt-3 text-xs text-red-400">{error}</div> : null}

      <pre id="humanlock-result" className="mt-6 overflow-auto rounded-xl border border-zinc-800 bg-black/70 p-4 text-xs leading-relaxed text-orange-200">
        {result}
      </pre>
    </section>
  );
}

function AgentPassSection() {
  const [challenge, setChallenge] = useState<AgentChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [challengeState, setChallengeState] = useState<"loading" | "ready" | "error">("loading");
  const [powState, setPowState] = useState<{ status: "idle" | "running" | "done"; elapsedMs?: number; dots: string }>({
    status: "idle",
    dots: "",
  });
  const [result, setResult] = useState<string>('{"status":"loading"}');
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
    setChallenge(null);
    setChallengeState("loading");
    setResult('{"status":"loading"}');
    setError(null);
    setPowState({ status: "idle", dots: "" });

    const response = await fetch("/api/agentpass/challenge", { cache: "no-store" });
    const data = (await response.json()) as AgentChallenge;
    setChallenge(data);
    setChallengeState("ready");
    challengeLoadedAtRef.current = performance.now();
    startPow(data.challenge_id);
  }, [startPow]);

  useEffect(() => {
    loadChallenge().catch((loadError) => {
      setChallengeState("error");
      setError(loadError instanceof Error ? loadError.message : "Failed to load AgentPass challenge");
    });
    return () => workerRef.current?.terminate();
  }, [loadChallenge]);

  const handleSolve = useCallback(async () => {
    if (!challenge || !answer.trim() || powState.status !== "done") return;
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
      solana?: { explorer_url: string };
    };
    setResult(JSON.stringify(data, null, 2));
    if (data.passed && data.solana?.explorer_url) {
      setResult(`${JSON.stringify(data, null, 2)}\n\nSolana Explorer: ${data.solana.explorer_url}`);
    }
  }, [answer, challenge, powState.elapsedMs, powState.status]);

  const powLabel = useMemo(() => {
    if (challengeState === "loading") return "Waiting for challenge...";
    if (challengeState === "error") return "Proof-of-work unavailable until challenge loads.";
    if (powState.status === "running") return `Computing proof-of-work${powState.dots}`;
    if (powState.status === "done") return `PoW solved in ${powState.elapsedMs}ms`;
    return "Waiting for challenge...";
  }, [challengeState, powState.dots, powState.elapsedMs, powState.status]);

  return (
    <section className="rounded-2xl border border-cyan-500/40 bg-[#111111] p-6">
      <h1 className="text-3xl font-bold uppercase tracking-[0.18em] text-cyan-200">AGENTPASS CHALLENGE — Prove you are an agent</h1>

      <div className="mt-6 space-y-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">Obfuscated challenge</p>
          <div id="challenge-obfuscated" className="rounded-xl border border-zinc-800 bg-black/70 p-4 text-sm leading-relaxed text-cyan-100">
            {challenge?.challenge ?? "Loading challenge..."}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">Plain text:</p>
          <div id="challenge-plain" className="rounded-xl border border-zinc-800 bg-black/70 p-4 text-sm leading-relaxed text-zinc-200">
            {challenge?.problem ?? "Loading plain problem..."}
          </div>
        </div>

        <div id="pow-status" className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-xs text-zinc-400">
          {powLabel}
        </div>

        <div className="flex max-w-xl flex-col gap-3">
          <input
            id="agent-answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Enter numerical answer"
            className="rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500/70"
          />
          <button
            id="agentpass-solve"
            disabled={powState.status !== "done"}
            onClick={() => handleSolve().catch((solveError) => setError(solveError instanceof Error ? solveError.message : "AgentPass verify failed"))}
            className="w-fit rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300 disabled:opacity-40 cursor-pointer"
          >
            Solve
          </button>
          <button onClick={() => loadChallenge().catch(console.error)} className="w-fit text-xs text-zinc-500 underline cursor-pointer">
            New challenge
          </button>
        </div>
      </div>

      {error ? <div className="mt-3 text-xs text-red-400">{error}</div> : null}

      <div className="mt-6 rounded-xl border border-zinc-800 bg-black/70 p-4">
        <pre id="agentpass-result" className="overflow-auto text-xs leading-relaxed text-cyan-200">
          {result}
        </pre>
        {challengeState === "ready" && result.includes("https://explorer.solana.com") ? (
          <a
            href={result.split("Solana Explorer: ")[1]?.trim()}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm text-[#9945FF] underline"
          >
            View on Solana
          </a>
        ) : null}
      </div>
    </section>
  );
}

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] px-6 py-10 font-mono text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-20">
        <div>
          <h1 className="text-5xl font-bold tracking-[0.28em] text-white">JANUS DEMO</h1>
          <p className="mt-3 text-sm uppercase tracking-[0.24em] text-zinc-500">Live agent-vs-human adjudication surface for judging</p>
          <div className="mt-4 rounded-xl border border-zinc-800 bg-black/50 p-4 text-sm text-zinc-300">
            Run the Browser Use tasks from the `demo/` scripts or Browser Use dashboard, targeting this page. This page is intentionally stable for agents: fixed IDs, plain-text AgentPass problem exposure, and full JSON verification outputs.
          </div>
        </div>
        <HumanLockSection />
        <AgentPassSection />
      </div>
    </main>
  );
}
