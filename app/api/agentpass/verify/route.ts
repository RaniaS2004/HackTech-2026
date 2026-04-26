import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

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

function cleanupExpired() {
  const now = Date.now();
  for (const [challengeId, entry] of challengeStore.entries()) {
    if (entry.expiresAt <= now) {
      challengeStore.delete(challengeId);
    }
  }
}

function base64Json(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64");
}

function signAgentToken(challengeId: string, model: string) {
  const now = Date.now();
  const header = base64Json({ typ: "JWT", alg: "HS256" });
  const payload = base64Json({ sub: "agent", iat: now, jti: challengeId, model });
  const signature = crypto
    .createHmac("sha256", process.env.TOKEN_SECRET || "janus-secret")
    .update(JSON.stringify({ challenge_id: challengeId, type: "agent", model, issued_at: now }))
    .digest("hex");
  return `${header}.${payload}.${signature}`;
}

function normalizeAnswer(value: string, unit: string) {
  let normalized = value.trim().toLowerCase();
  if (unit) {
    normalized = normalized.replace(new RegExp(unit.toLowerCase(), "g"), "");
  }
  normalized = normalized.replace(/[a-z$,%]+/gi, "").trim();
  return normalized;
}

function answersMatch(submitted: string, expected: string, unit: string) {
  const normalizedSubmitted = normalizeAnswer(submitted, unit);
  const normalizedExpected = normalizeAnswer(expected, unit);

  const submittedNumber = Number.parseFloat(normalizedSubmitted);
  const expectedNumber = Number.parseFloat(normalizedExpected);

  if (!Number.isNaN(submittedNumber) && !Number.isNaN(expectedNumber)) {
    return Math.abs(submittedNumber - expectedNumber) <= 0.1;
  }

  return normalizedSubmitted === normalizedExpected || submitted.trim().toLowerCase() === expected.trim().toLowerCase();
}

function rangeScore(value: number, min: number, max: number, points: number) {
  return value >= min && value <= max ? points : 0;
}

function classifyAgent(responseLatencyMs: number, powTimeMs: number) {
  const scores = [
    {
      model: "gpt-4o",
      score: rangeScore(responseLatencyMs, 700, 950, 50) + rangeScore(powTimeMs, 300, 450, 30) + 20,
    },
    {
      model: "claude",
      score: rangeScore(responseLatencyMs, 500, 750, 50) + rangeScore(powTimeMs, 200, 350, 30),
    },
    {
      model: "k2",
      score: rangeScore(responseLatencyMs, 100, 300, 50) + rangeScore(powTimeMs, 100, 200, 30),
    },
    {
      model: "gemini",
      score: rangeScore(responseLatencyMs, 400, 600, 50) + rangeScore(powTimeMs, 250, 400, 30),
    },
  ].sort((left, right) => right.score - left.score);

  const top = scores[0];
  if (!top || top.score < 40) {
    return {
      model: "unknown",
      confidence: 0.39,
      latency_ms: responseLatencyMs,
      pow_ms: powTimeMs,
    };
  }

  return {
    model: top.model,
    confidence: top.score / 100,
    latency_ms: responseLatencyMs,
    pow_ms: powTimeMs,
  };
}

export async function POST(req: NextRequest) {
  cleanupExpired();

  const payload = (await req.json()) as {
    challenge_id: string;
    answer: string;
    response_latency_ms: number;
    pow_time_ms: number;
  };

  const entry = challengeStore.get(payload.challenge_id);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) challengeStore.delete(payload.challenge_id);
    return NextResponse.json({ passed: false, reason: "challenge_expired" });
  }

  const isCorrect = answersMatch(payload.answer, entry.answer, entry.unit);
  if (!isCorrect) {
    challengeStore.delete(payload.challenge_id);
    return NextResponse.json({ passed: false, reason: "wrong_answer" });
  }

  challengeStore.delete(payload.challenge_id);
  const fingerprint = classifyAgent(payload.response_latency_ms, payload.pow_time_ms);

  return NextResponse.json({
    passed: true,
    fingerprint,
    token: signAgentToken(payload.challenge_id, fingerprint.model),
  });
}
