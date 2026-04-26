import { NextResponse } from "next/server";

const CHALLENGES = [
  "Which of these would make a better first date: a museum or a bowling alley?",
  "Complete this phrase a grandparent might say: Back in my day...",
  "What emotion does the color burnt orange remind you of?",
];

export async function GET() {
  const prompt = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];

  return NextResponse.json({
    challenge_id: crypto.randomUUID(),
    type: "cultural",
    prompt,
    expires_at: Date.now() + 30000,
  });
}
