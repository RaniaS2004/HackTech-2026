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
const PROMPT =
  'You generate obfuscated multi-step math challenges for AI agent authentication. The problem must require at least 2 calculation steps and produce a non-obvious decimal or large integer answer that a human cannot solve mentally in under 30 seconds. Output ONLY raw JSON: {problem: string, answer: string, unit: string, obfuscated: string}. The obfuscated field must: spell all numbers as words in a random non-English language (Toki Pona, Swahili, or Welsh), alternate caps on every character, inject random symbols (*#~@!|) between every 2-3 words, and replace common letters with unicode lookalikes (a→ａ, e→ｅ, o→ｏ, i→ｉ). Example problem types: compound interest over multiple periods, geometric series sum with non-obvious ratio, two-variable distance/rate problems, currency conversion chains. The plain text problem field should be the clean English version judges can read.';
const USER_MESSAGE =
  "Generate a new unique challenge now. Vary the type each time between: train/distance problems, geometric series, river crossing, compound interest, unit conversion, combinatorics.";

const FALLBACK_CHALLENGES = [
  { problem: "A train travels 80 mph for 3 hours. How far?", answer: "240", unit: "miles", obfuscated: "Α~ tＲaIＮ tＲaVｅLs 8#0 mＰＨ fＯR 3* h0UＲs. HＯW fＡＲ?" },
  { problem: "The geometric series 3, 9, 27... what is the 6th term?", answer: "729", unit: "", obfuscated: "ＴhＥ gＥＯmＥＴＲiＣ ~3, 9, 2#7... WＨΑＴ iＳ tＨE 6ＴＨ tＥＲm?" },
  { problem: "A boat crosses a river in 30 minutes at 12 km/h. How wide is the river?", answer: "6", unit: "km", obfuscated: "Α bＯΑＴ cＲＯＳＳｅＳ a #rIvＥＲ iＮ 3*0 mＩＮ aＴ 12 kＭ/h. HＯW wＩＤＥ?" },
  { problem: "What is the final amount on $100 at 10% annual interest compounded once?", answer: "110", unit: "dollars", obfuscated: "ＷhＡＴ iＳ tＨE fＩＮＡl aＭＯＵＮＴ 0Ｎ $1*00 aＴ 1#0% iＮＴｅＲＥＳＴ?" },
  { problem: "Convert 2.5 hours into minutes.", answer: "150", unit: "minutes", obfuscated: "ＣＯＮvＥＲＴ 2.5 hＯＵＲＳ iＮＴＯ mＩＮＵＴＥＳ~?" },
  { problem: "How many 2-person teams can be formed from 6 people?", answer: "15", unit: "teams", obfuscated: "ＨＯＷ mＡＮＹ 2-ＰＥＲＳＯＮ tＥＡmＳ fＲＯＭ 6 pＥＯＰＬＥ?" },
  { problem: "A runner goes 5 km north and 12 km east. How far from start?", answer: "13", unit: "km", obfuscated: "Α ＲＵＮＮＥＲ gＯＥＳ 5 kＭ nＯＲＴＨ & 1#2 kＭ eＡＳＴ. HＯＷ fＡＲ?" },
  { problem: "If 4 machines make 20 parts in an hour, how many parts do 6 machines make?", answer: "30", unit: "parts", obfuscated: "ＩＦ 4 mＡＣＨＩＮＥＳ mＡＫＥ 20 pＡＲＴＳ/h, HＯＷ mΑＮＹ dＯ 6?" },
  { problem: "What is 15% of 260?", answer: "39", unit: "", obfuscated: "ＷＨＡＴ iＳ 1#5% 0Ｆ 26*0?" },
  { problem: "There are 8 choose 3 combinations. How many?", answer: "56", unit: "", obfuscated: "ＴＨＥＲＥ ΑＲＥ 8 cＨＯＯＳＥ 3 cＯＭＢＯＳ. HＯＷ mΑＮＹ?" },
];

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

async function fetchK2Challenge() {
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
      model: "MBZUAI-IFM/K2-Think-v2",
      stream: false,
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: USER_MESSAGE },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`K2 request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return extractJsonObject(data.choices?.[0]?.message?.content ?? "");
}

async function fetchOpenAIChallenge() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: USER_MESSAGE },
      ],
      response_format: { type: "json_object" },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return extractJsonObject(data.choices?.[0]?.message?.content ?? "");
}

export async function GET() {
  cleanupExpired();

  let challenge: { answer: string; unit: string; obfuscated: string } | null = null;
  let source: "k2" | "openai" | "fallback" = "fallback";

  try {
    const generated = await fetchK2Challenge();
    challenge = {
      answer: String(generated.answer ?? "").trim(),
      unit: String(generated.unit ?? "").trim(),
      obfuscated: String(generated.obfuscated ?? "").trim(),
    };
    source = "k2";
    console.log("[K2] success");
  } catch {
    console.log("[K2] failed");
    try {
      const generated = await fetchOpenAIChallenge();
      challenge = {
        answer: String(generated.answer ?? "").trim(),
        unit: String(generated.unit ?? "").trim(),
        obfuscated: String(generated.obfuscated ?? "").trim(),
      };
      source = "openai";
    } catch {
      const fallback = FALLBACK_CHALLENGES[Math.floor(Math.random() * FALLBACK_CHALLENGES.length)];
      challenge = {
        answer: fallback.answer,
        unit: fallback.unit,
        obfuscated: fallback.obfuscated,
      };
      source = "fallback";
    }
  }

  const challengeId = crypto.randomUUID();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 120_000;

  challengeStore.set(challengeId, {
    answer: challenge.answer,
    unit: challenge.unit,
    issuedAt,
    expiresAt,
  });

  return NextResponse.json({
    challenge_id: challengeId,
    challenge: challenge.obfuscated,
    answer: challenge.answer,
    unit: challenge.unit,
    source,
    expires_at: expiresAt,
  });
}
