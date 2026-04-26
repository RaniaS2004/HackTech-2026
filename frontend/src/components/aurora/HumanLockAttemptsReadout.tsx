import { useEffect, useState } from "react";

const ATTEMPTS = [
  { model: "GPT-4o", confidence: 96, latency: 142, cadence: 23, result: "BLOCKED" },
  { model: "Claude 3.5 Sonnet", confidence: 94, latency: 188, cadence: 31, result: "BLOCKED" },
  { model: "Gemini 2.0 Flash", confidence: 89, latency: 96, cadence: 44, result: "BLOCKED" },
  { model: "GPT-4o-mini", confidence: 91, latency: 71, cadence: 52, result: "BLOCKED" },
  { model: "Llama 3.3 70B", confidence: 87, latency: 215, cadence: 18, result: "BLOCKED" },
];

export function HumanLockAttemptsReadout() {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const attempt = ATTEMPTS[index];

  const fullText = `> incoming agent attempt detected
Model detected:    ${attempt.model}
Confidence:        ${attempt.confidence}%
Latency signature: ${attempt.latency}ms
Token cadence:     ${attempt.cadence} t/s
HumanLock result:  ${attempt.result}`;

  useEffect(() => {
    setTyped("");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setTyped(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    const cycle = setInterval(() => {
      setIndex((i) => (i + 1) % ATTEMPTS.length);
    }, 4500);
    return () => clearInterval(cycle);
  }, []);

  return (
    <div className="rounded-xl border border-border bg-background/80 backdrop-blur-md">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
        </div>
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          aurora://humanlock/attempts
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          live
        </span>
      </div>
      <pre className="cursor-blink whitespace-pre p-5 font-mono text-xs leading-relaxed text-foreground sm:text-sm">
        {typed}
      </pre>
    </div>
  );
}
