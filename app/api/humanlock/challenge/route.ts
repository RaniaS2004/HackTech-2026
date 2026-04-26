import { NextResponse } from "next/server";
import { generateHumanLockFixtureChallenge } from "@/lib/humanlock-fixtures";

const FGSM_SERVICE_URL = process.env.FGSM_SERVICE_URL ?? "http://127.0.0.1:8001";
const ALLOW_FIXTURE_FALLBACK =
  (process.env.HUMANLOCK_ALLOW_FIXTURE_FALLBACK ?? (process.env.NODE_ENV === "production" ? "true" : "false")) === "true";

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
      source: "fgsm",
    });
  } catch {
    if (ALLOW_FIXTURE_FALLBACK) {
      const fixture = await generateHumanLockFixtureChallenge();
      return NextResponse.json({
        ...fixture,
        source: "fixture",
      });
    }

    return NextResponse.json(
      {
        error: "fgsm_unavailable",
        reason: "HumanLock requires the FGSM generator for live adversarial image challenges.",
      },
      { status: 503 },
    );
  }
}
