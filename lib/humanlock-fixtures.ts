import { readFile } from "node:fs/promises";
import path from "node:path";

type HumanLockFixture = {
  label: string;
  filename: string;
  aiSees: string;
  epsilon: number;
};

type HumanLockFixtureChallenge = {
  correctLabel: string;
  expiresAt: number;
};

declare global {
  var __janusHumanLockFixtureChallenges: Map<string, HumanLockFixtureChallenge> | undefined;
}

const FIXTURES: HumanLockFixture[] = [
  { label: "dog", filename: "dog.png", aiSees: "cat", epsilon: 0.018 },
  { label: "cat", filename: "cat.png", aiSees: "dog", epsilon: 0.06 },
  { label: "banana", filename: "banana.png", aiSees: "bird", epsilon: 0.023 },
  { label: "car", filename: "car.png", aiSees: "chair", epsilon: 0.08 },
  { label: "bird", filename: "bird.png", aiSees: "guitar", epsilon: 0.08 },
  { label: "chair", filename: "chair.png", aiSees: "clock", epsilon: 0.0305 },
  { label: "apple", filename: "apple.png", aiSees: "banana", epsilon: 0.08 },
  { label: "clock", filename: "clock.png", aiSees: "shoe", epsilon: 0.08 },
  { label: "shoe", filename: "shoe.png", aiSees: "clock", epsilon: 0.038 },
  { label: "guitar", filename: "guitar.png", aiSees: "bird", epsilon: 0.0805 },
];

const store =
  globalThis.__janusHumanLockFixtureChallenges ??
  (globalThis.__janusHumanLockFixtureChallenges = new Map<string, HumanLockFixtureChallenge>());

export function cleanupHumanLockFixtureChallenges() {
  const now = Date.now();
  for (const [challengeId, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(challengeId);
    }
  }
}

export async function generateHumanLockFixtureChallenge() {
  cleanupHumanLockFixtureChallenges();

  const fixture = FIXTURES[Math.floor(Math.random() * FIXTURES.length)];
  const challengeId = crypto.randomUUID();
  const expiresAt = Date.now() + 10 * 60_000;
  const filePath = path.join(process.cwd(), "public", "humanlock-fixtures", fixture.filename);
  const imageB64 = (await readFile(filePath)).toString("base64");

  store.set(challengeId, {
    correctLabel: fixture.label,
    expiresAt,
  });

  return {
    challenge_id: challengeId,
    image_b64: imageB64,
    correct_label: fixture.label,
    ai_sees: fixture.aiSees,
    epsilon: fixture.epsilon,
    type: "image" as const,
  };
}

export function verifyHumanLockFixtureChallenge(challengeId: string, answer: string) {
  cleanupHumanLockFixtureChallenges();

  const entry = store.get(challengeId);
  if (!entry) {
    return null;
  }

  const isCorrect = answer.trim().toLowerCase() === entry.correctLabel.toLowerCase();
  if (isCorrect) {
    store.delete(challengeId);
  }

  return isCorrect;
}
