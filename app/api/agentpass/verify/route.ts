import { NextRequest, NextResponse } from "next/server";
import { writeMemory } from "@/lib/backboard";

interface ChallengeEntry {
  answer: string;
  backboardThreadId: string | null;
  expiresAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __janusChallengMap: Map<string, ChallengeEntry> | undefined;
}

// ── Rule-based fingerprint classifier ────────────────────────────────────
function classifyAgent(response_latency_ms: number): {
  model: string;
  confidence: number;
  reasoning: string;
} {
  if (response_latency_ms < 300)
    return { model: "k2", confidence: 0.85, reasoning: `${response_latency_ms}ms sub-300ms consistent with K2` };
  if (response_latency_ms < 500)
    return { model: "gemini", confidence: 0.79, reasoning: `${response_latency_ms}ms consistent with Gemini (~500ms)` };
  if (response_latency_ms < 700)
    return { model: "claude", confidence: 0.82, reasoning: `${response_latency_ms}ms consistent with Claude (~600ms)` };
  if (response_latency_ms < 900)
    return { model: "gpt-4o", confidence: 0.87, reasoning: `${response_latency_ms}ms consistent with GPT-4o (~800ms)` };
  return { model: "unknown", confidence: 0.5, reasoning: `${response_latency_ms}ms outside known model latency ranges` };
}

// ── Loose numeric equality: "150" == "150.0" == "150 miles" ───────────────
function answersMatch(submitted: string, expected: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[^0-9.\-]/g, "");
  const a = norm(submitted);
  const b = norm(expected);
  if (a === b) return true;
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb)) return Math.abs(na - nb) < 0.01;
  return submitted.trim().toLowerCase() === expected.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const { challenge_id, answer, response_latency_ms } = await req.json();

  const challengeMap = globalThis.__janusChallengMap;
  const entry = challengeMap?.get(challenge_id);

  // Unknown or expired challenge
  if (!entry) {
    return NextResponse.json({ passed: false, error: "Unknown or expired challenge" });
  }
  if (Date.now() > entry.expiresAt) {
    challengeMap?.delete(challenge_id);
    return NextResponse.json({ passed: false, error: "Challenge expired" });
  }

  const passed = answersMatch(String(answer), entry.answer);

  if (!passed) {
    return NextResponse.json({ passed: false });
  }

  // ── Consume the challenge (one-time use) ──────────────────────────────
  challengeMap?.delete(challenge_id);

  // ── Rule-based fingerprint ────────────────────────────────────────────
  const fingerprint = classifyAgent(response_latency_ms ?? 750);

  // ── Write reputation memory to Backboard (best-effort, non-blocking) ──
  if (entry.backboardThreadId) {
    const memLine =
      `Agent verified at ${new Date().toISOString()}. ` +
      `Fingerprint: ${fingerprint.model} (${fingerprint.confidence} confidence). ` +
      `Latency: ${response_latency_ms}ms.`;
    writeMemory(entry.backboardThreadId, memLine).catch(() => {
      // non-fatal
    });
  }

  const token = Buffer.from(
    JSON.stringify({
      challenge_id,
      model: fingerprint.model,
      confidence: fingerprint.confidence,
      issued_at: Date.now(),
    })
  ).toString("base64");

  return NextResponse.json({ passed: true, fingerprint, token });
}
