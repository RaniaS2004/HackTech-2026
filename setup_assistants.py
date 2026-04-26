import requests
import json
import re

API_KEY = "espr_9dvmIADLXN7JuiWOqw52ktHNCHmQJmMnhAwrGRst1Ew"
BASE_URL = "https://app.backboard.io/api"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

# ── 1. Find K2 model ────────────────────────────────────────────────────────
print("=== Searching for K2 / IFM / MBZUAI models ===")
resp = requests.get(f"{BASE_URL}/models", params={"limit": 500}, headers=HEADERS)
print(f"Models endpoint status: {resp.status_code}")

k2_model = None
if resp.status_code == 200:
    data = resp.json()
    models = data if isinstance(data, list) else data.get("models", data.get("data", []))
    for m in models:
        name = str(m.get("name", "")).lower()
        provider = str(m.get("provider", "")).lower()
        model_id = str(m.get("id", m.get("model_id", ""))).lower()
        if "k2" in name or "k2" in model_id or "ifm" in provider or "mbzuai" in provider:
            print(f"  FOUND: {m}")
            if k2_model is None:
                k2_model = m.get("id") or m.get("model_id") or m.get("name")
else:
    print(f"  Response: {resp.text[:300]}")

if k2_model:
    print(f"\nUsing K2 model: {k2_model}")
else:
    k2_model = "openai/gpt-4o"
    print(f"\nK2 not found — falling back to: {k2_model}")

# ── 2. Create assistants ────────────────────────────────────────────────────
def create_assistant(name, system_prompt, model):
    payload = {
        "name": name,
        "model": model,
        "system_prompt": system_prompt,
    }
    r = requests.post(f"{BASE_URL}/assistants", headers=HEADERS, json=payload)
    print(f"\nCreate '{name}': status={r.status_code}")
    if r.status_code in (200, 201):
        data = r.json()
        aid = data.get("id") or data.get("assistant_id")
        print(f"  ID: {aid}")
        return aid
    else:
        print(f"  Error: {r.text[:400]}")
        return None

CHALLENGE_PROMPT = (
    'You generate math/logic challenges for AI agent verification. '
    'Output ONLY raw JSON no markdown no explanation in this format: '
    '{"problem": "Two trains 100 miles apart approach at 40mph and 60mph. '
    'A bird flies between them at 150mph until they meet. How far does the bird fly?", '
    '"answer": "150", "unit": "miles"}. '
    'Vary problem types every time between train/bird problems, geometric series, '
    'river crossing, and number puzzles. Never repeat.'
)

FINGERPRINT_PROMPT = (
    'You classify which AI model sent a request based on behavioral timing signals. '
    'Output ONLY raw JSON no markdown: '
    '{"model": "gpt-4o|claude|k2|gemini|unknown", "confidence": 0.87, '
    '"reasoning": "latency consistent with GPT-4o API round-trip"}. '
    'Reference latencies are GPT-4o ~800ms, Claude ~600ms, K2 ~200ms, Gemini ~500ms.'
)

challenge_id = create_assistant("JANUS Challenge Generator", CHALLENGE_PROMPT, k2_model)
fingerprint_id = create_assistant("JANUS Fingerprint Analyzer", FINGERPRINT_PROMPT, k2_model)

print("\n=== Assistant IDs ===")
print(f"CHALLENGE_ASSISTANT_ID={challenge_id}")
print(f"FINGERPRINT_ASSISTANT_ID={fingerprint_id}")

# ── 3. Write IDs into .env.local ────────────────────────────────────────────
if challenge_id and fingerprint_id:
    env_path = ".env.local"
    with open(env_path, "r") as f:
        content = f.read()
    content = re.sub(r"CHALLENGE_ASSISTANT_ID=.*", f"CHALLENGE_ASSISTANT_ID={challenge_id}", content)
    content = re.sub(r"FINGERPRINT_ASSISTANT_ID=.*", f"FINGERPRINT_ASSISTANT_ID={fingerprint_id}", content)
    with open(env_path, "w") as f:
        f.write(content)
    print(f"\n.env.local updated successfully.")
else:
    print("\nWARNING: Could not write IDs — one or both assistant creations failed.")
