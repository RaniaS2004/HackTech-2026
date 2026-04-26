import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifyHumanLockFixtureChallenge } from "@/lib/humanlock-fixtures";

const FGSM_SERVICE_URL = process.env.FGSM_SERVICE_URL ?? "http://127.0.0.1:8001";

interface Point {
  x: number;
  y: number;
  t: number;
}

function base64Json(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64");
}

function signHumanToken(challengeId: string) {
  const now = Date.now();
  const header = base64Json({ typ: "JWT", alg: "HS256" });
  const payload = base64Json({ sub: "human", iat: now, jti: challengeId });
  const signature = crypto
    .createHmac("sha256", process.env.TOKEN_SECRET || "janus-secret")
    .update(JSON.stringify({ challenge_id: challengeId, type: "human", issued_at: now }))
    .digest("hex");
  return `${header}.${payload}.${signature}`;
}

function computePathLinearity(points: Point[]) {
  if (points.length < 2) return 1;
  const first = points[0];
  const last = points[points.length - 1];
  const straightDistance = Math.hypot(last.x - first.x, last.y - first.y);
  let totalDistance = 0;
  for (let index = 1; index < points.length; index += 1) {
    totalDistance += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return straightDistance === 0 ? 1 : totalDistance / straightDistance;
}

export async function POST(req: NextRequest) {
  const referer = req.headers.get("referer") ?? "";
  const isDemoRequest = referer.includes("/demo");
  const payload = (await req.json()) as {
    challenge_id: string;
    answer: string;
    type: "image" | "text";
    mouse_signals?: {
      path_points?: Point[];
      click_time_ms?: number;
      tremor_score?: number;
    };
  };

  const pathPoints = Array.isArray(payload.mouse_signals?.path_points) ? payload.mouse_signals?.path_points : [];
  const clickTimeMs = typeof payload.mouse_signals?.click_time_ms === "number" ? payload.mouse_signals.click_time_ms : 0;
  const tremorScore = typeof payload.mouse_signals?.tremor_score === "number" ? payload.mouse_signals.tremor_score : 0;

  let answerCorrect = false;
  if (payload.type === "image") {
    const localFixtureResult = verifyHumanLockFixtureChallenge(payload.challenge_id, payload.answer);
    if (typeof localFixtureResult === "boolean") {
      answerCorrect = localFixtureResult;
    } else {
      try {
        const response = await fetch(`${FGSM_SERVICE_URL}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challenge_id: payload.challenge_id,
            answer: payload.answer,
          }),
          cache: "no-store",
        });
        const data = (await response.json()) as { correct?: boolean };
        answerCorrect = data.correct === true;
      } catch {
        answerCorrect = false;
      }
    }

    if (!answerCorrect) {
      return NextResponse.json({
        passed: false,
        score: 0,
        reason: "wrong_answer",
      });
    }
  } else {
    answerCorrect = typeof payload.answer === "string" && payload.answer.trim().length > 4;
  }

  const pathLinearity = computePathLinearity(pathPoints);
  const tremorPassed = tremorScore > 0.05;
  const linearityPassed = pathLinearity > 1.3;
  const timingPassed = clickTimeMs >= 50 && clickTimeMs <= 3000;
  const demoBehaviorPassed = tremorScore > 0.08 && pathLinearity > 1.5 && clickTimeMs > 100;

  let score = 0;
  if (tremorPassed) score += 30;
  if (linearityPassed) score += 30;
  if (timingPassed) score += 20;
  if (answerCorrect) score += 20;

  const passed = isDemoRequest ? score >= 60 && demoBehaviorPassed : score >= 60;

  return NextResponse.json({
    passed,
    score,
    reason: passed ? null : isDemoRequest && score >= 60 && !demoBehaviorPassed ? "demo_behavioral_gate_failed" : "behavioral_score_too_low",
    breakdown: {
      tremor: tremorPassed,
      linearity: Number(pathLinearity.toFixed(3)),
      timing: timingPassed,
      answer: answerCorrect,
      demo_behavior_gate: isDemoRequest ? demoBehaviorPassed : undefined,
    },
    token: passed ? signHumanToken(payload.challenge_id) : null,
  });
}
