const BASE = "https://app.backboard.io/api";
const HEADERS = {
  "X-API-Key": process.env.BACKBOARD_API_KEY!,
  "Content-Type": "application/json",
};

export async function createThread(assistantId: string) {
  const r = await fetch(`${BASE}/assistants/${assistantId}/threads`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({}),
  });
  return r.json();
}

export async function writeMemory(threadId: string, content: string) {
  await fetch(`${BASE}/threads/${threadId}/messages`, {
    method: "POST",
    headers: { "X-API-Key": process.env.BACKBOARD_API_KEY! },
    body: new URLSearchParams({ content, memory: "Auto", stream: "false" }),
  });
}
