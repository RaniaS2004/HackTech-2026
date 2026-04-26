import { NextResponse } from "next/server";
import k2 from "@/lib/k2";
import { createThread } from "@/lib/backboard";

interface ChallengeEntry {
  answer: string;
  backboardThreadId: string | null;
  expiresAt: number;
}

// Server-side in-memory store: challenge_id → { answer, backboardThreadId }
// In production this would be Redis; for the demo a module-level Map is fine
declare global {
  // eslint-disable-next-line no-var
  var __janusChallengMap: Map<string, ChallengeEntry> | undefined;
}
const challengeMap: Map<string, ChallengeEntry> =
  globalThis.__janusChallengMap ?? (globalThis.__janusChallengMap = new Map());

const FALLBACK_CHALLENGES = [
  { problem: "Two trains 100 miles apart approach each other at 40 mph and 60 mph. A bird flies between them at 150 mph until they meet. How far does the bird fly?", answer: "150", unit: "miles" },
  { problem: "A geometric series starts 2, 6, 18, 54... What is the 7th term?", answer: "1458", unit: "" },
  { problem: "A farmer has 17 sheep. All but 9 die. How many are left?", answer: "9", unit: "" },
  { problem: "What is the sum of the first 10 positive integers?", answer: "55", unit: "" },
  { problem: "A clock shows 3:15. What is the angle between the hour and minute hands?", answer: "7.5", unit: "degrees" },
  { problem: "If a snail climbs 3 feet up a 10-foot wall each day and slides back 2 feet each night, on what day does it reach the top?", answer: "8", unit: "days" },
];

export async function GET() {
  const reputationAssistantId = process.env.REPUTATION_ASSISTANT_ID;
  const challenge_id = crypto.randomUUID();
  let problem = "";
  let answer = "";

  // ── 1. Try K2 for dynamic challenge generation ───────────────────────────
  const k2Available = !!process.env.K2_API_KEY;

  if (k2Available) {
    try {
      const completion = await k2.chat.completions.create({
        model: "MBZUAI-IFM/K2-Think-v2",
        stream: false,
        messages: [
          {
            role: "system",
            content:
              'Output ONLY raw JSON no markdown: {"problem": string, "answer": string, "unit": string}. Classic math problems only, vary every time.',
          },
          { role: "user", content: "Generate a new verification challenge." },
        ],
        max_tokens: 200,
      });
      const raw = completion.choices[0]?.message?.content ?? "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        problem = parsed.problem ?? "";
        answer = String(parsed.answer ?? "");
      }
    } catch {
      // fall through to local fallback
    }
  }

  // ── 2. Fall back to local challenge pool if K2 unavailable or failed ─────
  if (!problem) {
    const fb = FALLBACK_CHALLENGES[Math.floor(Math.random() * FALLBACK_CHALLENGES.length)];
    problem = fb.problem;
    answer = fb.answer;
  }

  // ── 3. Create Backboard session thread for reputation tracking ───────────
  let backboardThreadId: string | null = null;
  if (reputationAssistantId) {
    try {
      const thread = await createThread(reputationAssistantId);
      backboardThreadId = thread.id ?? thread.thread_id ?? null;
    } catch {
      // non-fatal — reputation tracking is best-effort
    }
  }

  // ── 4. Store in server-side map ──────────────────────────────────────────
  challengeMap.set(challenge_id, {
    answer,
    backboardThreadId,
    expiresAt: Date.now() + 15000,
  });

  return NextResponse.json({
    challenge_id,
    challenge: problem,
    expires_at: Date.now() + 15000,
  });
}
