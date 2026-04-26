import { NextResponse } from "next/server";

const FGSM_SERVICE_URL = process.env.FGSM_SERVICE_URL ?? "http://127.0.0.1:8001";

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
    return NextResponse.json(
      {
        error: "fgsm_unavailable",
        reason: "HumanLock requires the FGSM generator for live adversarial image challenges.",
      },
      { status: 503 },
    );
  }
}
