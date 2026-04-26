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
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
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

function extractMessageContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .join("");
  }

  return "";
}

async function fetchChatCompletion({
  baseUrl,
  apiKey,
  model,
  signal,
  forceJsonObject = false,
}: {
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
  signal?: AbortSignal;
  forceJsonObject?: boolean;
}) {
  if (!apiKey) {
    throw new Error(`${model} API key missing`);
  }

  const body: {
    model: string;
    stream: false;
    messages: Array<{ role: "system" | "user"; content: string }>;
    response_format?: { type: "json_object" };
  } = {
    model,
    stream: false,
    messages: [
      { role: "system", content: PROMPT },
      { role: "user", content: USER_MESSAGE },
    ],
  };

  if (forceJsonObject) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`${model} request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  return extractJsonObject(extractMessageContent(data.choices?.[0]?.message?.content));
}

async function fetchK2Challenge(signal?: AbortSignal) {
  return fetchChatCompletion({
    baseUrl: K2_BASE_URL,
    apiKey: process.env.K2_API_KEY,
    model: K2_MODEL,
    signal,
  });
}

async function fetchOpenAIChallenge(signal?: AbortSignal) {
  return fetchChatCompletion({
    baseUrl: OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
    model: OPENAI_MODEL,
    signal,
    forceJsonObject: true,
  });
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

function issueChallenge(challenge: { answer: string; unit: string; obfuscated: string; problem: string }, source: "k2" | "openai") {
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
    source,
    expires_at: expiresAt,
  });
}

export async function GET() {
  cleanupExpired();
  let challenge: { answer: string; unit: string; obfuscated: string; problem: string } | null = null;
  let source: "k2" | "openai" = "k2";
  let k2FailureReason: string | null = null;

  const k2Controller = new AbortController();
  const k2TimeoutId = setTimeout(() => k2Controller.abort(), K2_TIMEOUT_MS);
  try {
    const generated = await fetchK2Challenge(k2Controller.signal);
    challenge = normalizeChallenge(generated);
    console.log("[K2] success");
  } catch (error) {
    k2FailureReason = getErrorMessage(error);
    console.error("[K2] failed", k2FailureReason);
  } finally {
    clearTimeout(k2TimeoutId);
  }

  if (!k2FailureReason && challenge) {
    return issueChallenge(challenge, source);
  }

  const openAiController = new AbortController();
  const openAiTimeoutId = setTimeout(() => openAiController.abort(), K2_TIMEOUT_MS);
  try {
    const generated = await fetchOpenAIChallenge(openAiController.signal);
    challenge = normalizeChallenge(generated);
    source = "openai";
    console.log("[OpenAI] fallback success");
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("[OpenAI] fallback failed", message);
    return NextResponse.json(
      {
        error: "AgentPass challenge unavailable",
        reason: `K2 failed: ${k2FailureReason}. OpenAI failed: ${message}.`,
        source: "openai",
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(openAiTimeoutId);
  }

  if (!challenge) {
    return NextResponse.json(
      {
        error: "AgentPass challenge unavailable",
        reason: "Challenge generation returned no challenge payload.",
        source,
      },
      { status: 503 },
    );
  }

  return issueChallenge(challenge, source);
}
