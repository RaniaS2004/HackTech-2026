import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { challenge_id, answer, mouse_signals } = await req.json();

  const { tremor_detected, path_linearity, click_time_ms } = mouse_signals ?? {};

  let score = 0;
  if (tremor_detected === true) score += 30;
  if (typeof path_linearity === "number" && path_linearity < 0.3) score += 30;
  if (typeof click_time_ms === "number" && click_time_ms >= 200 && click_time_ms <= 1200) score += 20;
  if (typeof answer === "string" && answer.length > 3) score += 20;

  const passed = score >= 60;

  const token = passed
    ? Buffer.from(JSON.stringify({ challenge_id, issued_at: Date.now() })).toString("base64")
    : undefined;

  return NextResponse.json({ passed, score, token });
}
