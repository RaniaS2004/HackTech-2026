import { NextResponse } from "next/server";

const FGSM_SERVICE_URL = process.env.FGSM_SERVICE_URL ?? "http://127.0.0.1:8001";

const TEXT_CHALLENGES = [
  "Which of these smells worse after rain: a wet dog or an old book?",
  "What does the color yellow taste like to most people?",
  "Which would a nervous person do first: check their phone or check their hair?",
  "What sound does silence make when you're scared?",
  "Which feels longer: five minutes in a waiting room or five minutes at a party?",
  "Which apology sounds more sincere: 'my bad' or 'I really hurt you'?",
  "What kind of laugh makes a room feel uncomfortable faster: too loud or too delayed?",
  "Which object seems lonelier on a table: one key or one glove?",
];

export async function GET() {
  try {
    const response = await fetch(`${FGSM_SERVICE_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`FGSM service error ${response.status}`);
    }

    const data = (await response.json()) as {
      challenge_id: string;
      image_b64: string;
      correct_label: string;
      ai_sees: string;
      epsilon: number;
    };

    return NextResponse.json({
      ...data,
      type: "image",
    });
  } catch {
    const question = TEXT_CHALLENGES[Math.floor(Math.random() * TEXT_CHALLENGES.length)];
    return NextResponse.json({
      challenge_id: crypto.randomUUID(),
      question,
      type: "text",
    });
  }
}
