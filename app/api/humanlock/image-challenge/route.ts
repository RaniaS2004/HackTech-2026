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
      return NextResponse.json({ error: "fgsm_unavailable" }, { status: 503 });
    }

    const data = await response.json();
    return NextResponse.json({
      ...data,
      type: "image",
    });
  } catch {
    return NextResponse.json({ error: "fgsm_unavailable" }, { status: 503 });
  }
}
