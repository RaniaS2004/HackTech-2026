import { NextResponse } from "next/server";

interface AgentPassChallengeEntry {
  answer: string;
  unit: string;
  issuedAt: number;
  expiresAt: number;
}

declare global {
  var __janusAgentPassChallenges: Map<string, AgentPassChallengeEntry> | undefined;
}

const challengeStore = globalThis.__janusAgentPassChallenges ?? (globalThis.__janusAgentPassChallenges = new Map());
const K2_BASE_URL = process.env.K2_BASE_URL ?? "https://api.k2think.ai/v1";
const K2_MODEL = process.env.K2_MODEL ?? "MBZUAI-IFM/K2-Think-v2";
const parsedK2TimeoutMs = Number.parseInt(process.env.AGENTPASS_K2_TIMEOUT_MS ?? "180000", 10);
const K2_TIMEOUT_MS = Number.isFinite(parsedK2TimeoutMs) ? parsedK2TimeoutMs : 180_000;
const PROMPT =
  'You generate obfuscated multi-step math challenges for AI agent authentication. The problem must require at least 2 calculation steps and produce a non-obvious decimal or large integer answer that a human cannot solve mentally in under 30 seconds. Output ONLY raw JSON: {problem: string, answer: string, unit: string, obfuscated: string}. The obfuscated field must: spell all numbers as words in a random non-English language (Toki Pona, Swahili, or Welsh), alternate caps on every character, inject random symbols (*#~@!|) between every 2-3 words, and replace common letters with unicode lookalikes (a→ａ, e→ｅ, o→ｏ, i→ｉ). Example problem types: compound interest over multiple periods, geometric series sum with non-obvious ratio, two-variable distance/rate problems, currency conversion chains. The problem field should be the clean English source problem for server-side bookkeeping only.';
const USER_MESSAGE =
  "Generate a new unique challenge now. Vary the type each time between: train/distance problems, geometric series, river crossing, compound interest, unit conversion, combinatorics.";

function cleanupExpired() {
  const now = Date.now();
  for (const [challengeId, entry] of challengeStore.entries()) {
    if (entry.expiresAt <= now) {
      challengeStore.delete(challengeId);
    }
  }
}

function extractJsonObject(content: string) {
  const raw = content;
  const afterThink = raw.includes("</think>") ? raw.split("</think>").slice(1).join("</think>") : raw;
  const firstBrace = afterThink.indexOf("{");
  const lastBrace = afterThink.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("No JSON object found in model response");
  }
  const jsonStr = afterThink.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonStr) as {
    problem?: string;
    answer?: string;
    unit?: string;
    obfuscated?: string;
  };
}

async function fetchK2Challenge(signal?: AbortSignal) {
  if (!process.env.K2_API_KEY) {
    throw new Error("K2_API_KEY missing");
  }

  const response = await fetch(`${K2_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.K2_API_KEY}`,
    },
    body: JSON.stringify({
      model: K2_MODEL,
      stream: false,
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: USER_MESSAGE },
      ],
    }),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`K2 request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return extractJsonObject(data.choices?.[0]?.message?.content ?? "");
}

function normalizeChallenge(generated: {
  problem?: string;
  answer?: string;
  unit?: string;
  obfuscated?: string;
}) {
  const challenge = {
    problem: String(generated.problem ?? "").trim(),
    answer: String(generated.answer ?? "").trim(),
    unit: String(generated.unit ?? "").trim(),
    obfuscated: String(generated.obfuscated ?? "").trim(),
  };

  if (!challenge.problem || !challenge.answer || !challenge.obfuscated) {
    throw new Error("K2 response was missing required challenge fields");
  }

  return challenge;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.name === "AbortError" ? `K2 request timed out after ${K2_TIMEOUT_MS}ms` : error.message;
  }
  return "Unknown K2 error";
}

export async function GET() {
  cleanupExpired();
  let challenge: { answer: string; unit: string; obfuscated: string; problem: string };

  const k2Controller = new AbortController();
  const k2TimeoutId = setTimeout(() => k2Controller.abort(), K2_TIMEOUT_MS);
  try {
    const generated = await fetchK2Challenge(k2Controller.signal);
    challenge = normalizeChallenge(generated);
    console.log("[K2] success");
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("[K2] failed", message);
    return NextResponse.json(
      {
        error: "AgentPass K2 challenge unavailable",
        reason: message,
        source: "k2",
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(k2TimeoutId);
  }

  const challengeId = crypto.randomUUID();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 600_000;

  challengeStore.set(challengeId, {
    answer: challenge.answer,
    unit: challenge.unit,
    issuedAt,
    expiresAt,
  });

  return NextResponse.json({
    challenge_id: challengeId,
    challenge: challenge.obfuscated,
    source: "k2",
    expires_at: expiresAt,
  });
}
