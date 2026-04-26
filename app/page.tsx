"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface MouseSignals {
  tremor_detected: boolean;
  path_linearity: number;
  click_time_ms: number;
}

interface IdentityResult {
  side: "human" | "agent";
  passed: boolean;
  score?: number;
  fingerprint?: { model: string; confidence: number; reasoning?: string };
  token?: string;
  timestamp: number;
}

// ── HumanLock Panel ────────────────────────────────────────────────────────

function HumanLockPanel({ onResult }: { onResult: (r: IdentityResult) => void }) {
  const [challenge, setChallenge] = useState<{ challenge_id: string; prompt: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "pass" | "fail">("idle");
  const [score, setScore] = useState<number | null>(null);

  const mousePoints = useRef<{ x: number; y: number }[]>([]);
  const mouseDownTime = useRef<number>(0);
  const clickTimeMs = useRef<number>(500);

  useEffect(() => {
    fetch("/api/humanlock/challenge")
      .then((r) => r.json())
      .then(setChallenge)
      .catch(console.error);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    mousePoints.current.push({ x: e.clientX, y: e.clientY });
    if (mousePoints.current.length > 100) mousePoints.current.shift();
  }, []);

  const onMouseDown = useCallback(() => {
    mouseDownTime.current = Date.now();
  }, []);

  const onMouseUp = useCallback(() => {
    if (mouseDownTime.current > 0) {
      clickTimeMs.current = Date.now() - mouseDownTime.current;
      mouseDownTime.current = 0;
    }
  }, []);

  const computeSignals = (): MouseSignals => {
    const pts = mousePoints.current;
    if (pts.length < 5) {
      return { tremor_detected: false, path_linearity: 0.5, click_time_ms: clickTimeMs.current };
    }
    const dists = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
    const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
    const stddev = Math.sqrt(dists.reduce((a, b) => a + (b - mean) ** 2, 0) / dists.length);
    const tremor_detected = stddev > 3.5;
    const first = pts[0];
    const last = pts[pts.length - 1];
    const straight = Math.hypot(last.x - first.x, last.y - first.y);
    const pathLen = dists.reduce((a, b) => a + b, 0) || 1;
    const path_linearity = Math.min(1, straight / pathLen);
    return { tremor_detected, path_linearity, click_time_ms: clickTimeMs.current };
  };

  const handleSubmit = async () => {
    if (!challenge || !answer.trim()) return;
    setStatus("loading");
    const signals = computeSignals();
    try {
      const res = await fetch("/api/humanlock/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challenge.challenge_id, answer, mouse_signals: signals }),
      });
      const data = await res.json();
      setStatus(data.passed ? "pass" : "fail");
      setScore(data.score ?? null);
      onResult({ side: "human", passed: data.passed, score: data.score, token: data.token, timestamp: Date.now() });
    } catch {
      setStatus("fail");
    }
  };

  const refresh = () => {
    setStatus("idle");
    setAnswer("");
    setScore(null);
    mousePoints.current = [];
    fetch("/api/humanlock/challenge")
      .then((r) => r.json())
      .then(setChallenge)
      .catch(console.error);
  };

  return (
    <div
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      className="flex-1 border border-orange-500/40 rounded-lg p-6 bg-[#0f0f0f] flex flex-col gap-4"
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-orange-500 text-xl">👤</span>
          <span className="text-orange-400 font-bold text-sm tracking-widest uppercase">HumanLock</span>
        </div>
        <p className="text-zinc-500 text-xs">Prove you&apos;re human</p>
      </div>

      <div className="border border-orange-500/20 rounded p-3 bg-black/40 min-h-[60px]">
        <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2">Cultural Challenge</p>
        <p className="text-orange-100 text-sm leading-relaxed">
          {challenge ? challenge.prompt : "Loading challenge..."}
        </p>
      </div>

      <div className="text-[10px] text-zinc-600 border border-zinc-800 rounded px-3 py-2 bg-black/20 flex gap-3">
        <span className="text-zinc-500">mouse tracking active</span>
        <span>·</span>
        <span>{mousePoints.current.length} pts</span>
        <span>·</span>
        <span>click_time={clickTimeMs.current}ms</span>
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Your answer..."
          className="bg-black border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/60 transition-colors"
        />
        <button
          onClick={handleSubmit}
          disabled={status === "loading" || !challenge}
          className="bg-orange-500/10 border border-orange-500/40 hover:bg-orange-500/20 text-orange-400 text-sm py-2 rounded transition-colors disabled:opacity-40 cursor-pointer"
        >
          {status === "loading" ? "Verifying..." : "Submit"}
        </button>
      </div>

      {status === "pass" && (
        <div className="flex items-center gap-2 text-green-400 text-sm border border-green-500/30 rounded p-3 bg-green-500/5">
          <span>✓</span>
          <span>Human verified{score !== null ? ` — score ${score}/100` : ""}</span>
        </div>
      )}
      {status === "fail" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-red-400 text-sm border border-red-500/30 rounded p-3 bg-red-500/5">
            <span>✗</span>
            <span>Bot detected{score !== null ? ` — score ${score}/100` : ""}</span>
          </div>
          <button onClick={refresh} className="text-xs text-zinc-500 hover:text-zinc-300 underline text-left cursor-pointer">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

// ── AgentPass Panel ────────────────────────────────────────────────────────

function AgentPassPanel({ onResult }: { onResult: (r: IdentityResult) => void }) {
  const [challenge, setChallenge] = useState<{
    challenge_id: string;
    challenge: string;
    expires_at: number;
  } | null>(null);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "pass" | "fail">("idle");
  const [fingerprint, setFingerprint] = useState<{ model: string; confidence: number } | null>(null);

  const loadChallenge = useCallback(() => {
    setStatus("idle");
    setAnswer("");
    setFingerprint(null);
    fetch("/api/agentpass/challenge")
      .then((r) => r.json())
      .then(setChallenge)
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadChallenge();
  }, [loadChallenge]);

  const handleSolve = async () => {
    if (!challenge || !answer.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/agentpass/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: challenge.challenge_id,
          answer,
          response_latency_ms: 750,
          pow_time_ms: 340,
        }),
      });
      const data = await res.json();
      if (data.passed) {
        setFingerprint(data.fingerprint);
        setStatus("pass");
        onResult({ side: "agent", passed: true, fingerprint: data.fingerprint, token: data.token, timestamp: Date.now() });
      } else {
        setStatus("fail");
        onResult({ side: "agent", passed: false, timestamp: Date.now() });
      }
    } catch {
      setStatus("fail");
    }
  };

  return (
    <div className="flex-1 border border-cyan-500/40 rounded-lg p-6 bg-[#0f0f0f] flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-cyan-400 text-xl">🤖</span>
          <span className="text-cyan-400 font-bold text-sm tracking-widest uppercase">AgentPass</span>
        </div>
        <p className="text-zinc-500 text-xs">Prove you&apos;re an agent</p>
      </div>

      <div className="border border-cyan-500/20 rounded p-3 bg-black/40 min-h-[60px]">
        <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2">Math / Logic Challenge</p>
        <p className="text-cyan-100 text-sm leading-relaxed">
          {challenge ? challenge.challenge : "Loading challenge..."}
        </p>
      </div>

      <div className="text-[10px] text-zinc-600 border border-zinc-800 rounded px-3 py-2 bg-black/20 flex gap-3">
        <span className="text-zinc-500">simulated agent signals</span>
        <span>·</span>
        <span>latency=750ms</span>
        <span>·</span>
        <span>pow=340ms</span>
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSolve()}
          placeholder="Numerical answer..."
          className="bg-black border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-cyan-500/60 transition-colors"
        />
        <button
          onClick={handleSolve}
          disabled={status === "loading" || !challenge}
          className="bg-cyan-500/10 border border-cyan-500/40 hover:bg-cyan-500/20 text-cyan-400 text-sm py-2 rounded transition-colors disabled:opacity-40 cursor-pointer"
        >
          {status === "loading" ? "Verifying..." : "Solve"}
        </button>
      </div>

      {status === "pass" && (
        <div className="flex items-center gap-2 text-green-400 text-sm border border-green-500/30 rounded p-3 bg-green-500/5">
          <span>🤖</span>
          <span>
            Agent verified — Detected:{" "}
            {fingerprint
              ? `${fingerprint.model} (${Math.round(fingerprint.confidence * 100)}% confidence)`
              : "unknown"}
          </span>
        </div>
      )}
      {status === "fail" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-red-400 text-sm border border-red-500/30 rounded p-3 bg-red-500/5">
            <span>✗</span>
            <span>Verification failed</span>
          </div>
          <button onClick={loadChallenge} className="text-xs text-zinc-500 hover:text-zinc-300 underline text-left cursor-pointer">
            New challenge
          </button>
        </div>
      )}
    </div>
  );
}

// ── Identity Readout ───────────────────────────────────────────────────────

function IdentityReadout({ result }: { result: IdentityResult | null }) {
  const [pulse, setPulse] = useState(false);
  const prevTimestamp = useRef<number>(0);

  useEffect(() => {
    if (result && result.timestamp !== prevTimestamp.current) {
      prevTimestamp.current = result.timestamp;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 900);
      return () => clearTimeout(t);
    }
  }, [result]);

  const displayObj = result
    ? {
        side: result.side,
        passed: result.passed,
        ...(result.score !== undefined && { score: result.score }),
        ...(result.fingerprint && { fingerprint: result.fingerprint }),
        ...(result.token && { token: result.token.slice(0, 32) + "..." }),
        issued_at: result.timestamp,
      }
    : null;

  return (
    <div
      className={`border rounded-lg p-5 bg-[#0f0f0f] flex flex-col gap-3 transition-all duration-300 ${
        pulse ? "pulse-update border-cyan-500/60" : "border-zinc-700/40"
      }`}
      style={{ minWidth: 240, maxWidth: 300 }}
    >
      <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">JANUS Identity Layer</p>
      <p className="text-zinc-600 text-[10px] uppercase tracking-widest">Last Verification Result</p>
      <pre className="text-xs text-cyan-300/80 leading-relaxed overflow-auto max-h-56 whitespace-pre-wrap break-all">
        {displayObj
          ? JSON.stringify(displayObj, null, 2)
          : '{\n  "status":\n    "awaiting verification..."\n}'}
      </pre>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Home() {
  const [lastResult, setLastResult] = useState<IdentityResult | null>(null);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-200 font-mono flex flex-col items-center px-4 py-12 gap-10">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-[0.25em] text-white mb-3">JANUS</h1>
        <p className="text-zinc-500 text-sm tracking-[0.2em] uppercase">Identity Layer for the Agentic Web</p>
        <div className="mt-4 flex justify-center gap-3">
          <span className="text-[10px] border border-orange-500/30 text-orange-500/80 px-2 py-0.5 rounded tracking-widest">
            HumanLock
          </span>
          <span className="text-zinc-700 text-[10px] self-center">⟷</span>
          <span className="text-[10px] border border-cyan-500/30 text-cyan-500/80 px-2 py-0.5 rounded tracking-widest">
            AgentPass
          </span>
        </div>
      </div>

      {/* Panels */}
      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-6 items-stretch">
        <HumanLockPanel onResult={setLastResult} />

        <div className="flex-shrink-0 flex items-center justify-center">
          <IdentityReadout result={lastResult} />
        </div>

        <AgentPassPanel onResult={setLastResult} />
      </div>

      <p className="text-zinc-700 text-[10px] tracking-widest uppercase">
        HackTech 2026 · Dual-sided identity verification
      </p>
    </main>
  );
}
