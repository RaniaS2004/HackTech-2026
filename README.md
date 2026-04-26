# AURORA

**Identity for the agentic web.**

AURORA is an AI-native identity layer built for a world where both humans and autonomous agents browse, transact, and operate online. The project has two complementary products:

- **HumanLock**: a defense layer that uses adversarial image challenges plus lightweight behavior signals to block AI agents pretending to be humans.
- **AgentPass**: a reverse CAPTCHA for trusted agents, where an AI system proves it is an authorized machine, receives a signed token, and can optionally write a reputation record to Solana devnet.

This repo is the current MVP and technical demo for that idea.

## The Idea

The internet was designed around a simple assumption: if something is using a browser, it is probably a human. That assumption is breaking. In 2026-style software, websites increasingly need to answer two different questions:

1. Is this really a person?
2. If it is not a person, is it an agent we should trust?

Most bot-defense products only solve the first half. They try to keep machines out. AURORA is built around the idea that modern systems need both **rejection** and **admission**:

- reject unauthorized automation,
- admit legitimate agents,
- and issue machine-readable proof about what happened.

That is why AURORA is split into **HumanLock** and **AgentPass** rather than treating every non-human visitor as abuse.

## YC Prompt Fit

This project is our answer to the YC prompt:

> What if you could rebuild Airbnb, Dropbox, Reddit, or PagerDuty, but as if it were born in 2026 with AI at its core?

We chose **Castle.io** and reimagined it for the post-ChatGPT internet.

Castle.io was a **YC Winter 2016** company focused on blocking bots, account takeovers, fake accounts, and other bad behavior. If Castle were founded today, the product would need to assume that many automated visitors are no longer crude scripts. They are model-driven agents with vision, reasoning, tool use, and browser control. At the same time, some of those agents are valuable and should be allowed in. A 2026-native version of Castle therefore should not just ask, "How do we stop bots?" It should ask, "How do we separate malicious automation from permitted automation, and how do we give each path the right proof?" AURORA is our answer: **HumanLock** blocks untrusted agents trying to impersonate humans, and **AgentPass** verifies trusted agents and grants signed identity.

In short: this is not a clone of Castle. It is a reframing of Castle for the agentic web.

## What We Have Built So Far

The current MVP already demonstrates the core product thesis:

- a polished landing page and product story for **AURORA**
- a dedicated **HumanLock** flow for human verification
- a dedicated **AgentPass** flow for agent verification
- live API routes for issuing and verifying both challenge types
- a Python sidecar service that generates adversarial image challenges with FGSM against `ResNet18`
- browser-automation demos showing:
  - an AI agent failing HumanLock
  - an AI agent passing AgentPass
- signed response tokens for successful verification
- optional **Solana devnet memo** writes for agent reputation

This means the project is already more than a mock landing page. It is a working demo of a dual-track identity architecture.

## Product Overview

### HumanLock

HumanLock is designed to be easy for people and brittle for AI agents.

Current implementation:

- requests a live adversarial image challenge from the Python FGSM service
- shows a perturbed image that still looks obvious to a person
- asks the user to pick the correct label
- captures mouse path points, click timing, and a simple tremor score
- computes a behavioral score on the server
- returns a signed `"human"` token on success

The design principle is straightforward: the challenge should reward human perception and punish machine regularity.

### AgentPass

AgentPass is for AI systems that are supposed to be there.

Current implementation:

- generates an obfuscated multi-step math challenge using **K2**
- falls back to **OpenAI** if K2 challenge generation fails
- starts a client-side SHA-256 proof-of-work job in a web worker
- measures solve latency and proof-of-work timing
- verifies the answer server-side
- classifies the likely agent family from timing heuristics
- issues a signed `"agent"` token on success
- optionally writes a memo transaction to **Solana devnet**

The design principle here is the opposite of HumanLock: instead of making the task hostile to machines, it gives authorized machines a structured path to prove themselves.

## Technical Architecture

### 1. Next.js application

The main app lives at the repo root and is built with:

- **Next.js 15**
- **React 19**
- **TypeScript**
- Tailwind-based styling

Key routes:

- `/` -> AURORA landing page
- `/humanlock` -> HumanLock product page and interactive demo
- `/agentpass` -> AgentPass product page and interactive demo
- `/demo` -> raw side-by-side demo surface used by browser automation scripts

Key server routes:

- `app/api/humanlock/challenge/route.ts`
- `app/api/humanlock/verify/route.ts`
- `app/api/agentpass/challenge/route.ts`
- `app/api/agentpass/verify/route.ts`

### 2. HumanLock adversarial image service

The `fgsm-service/` directory contains a separate **FastAPI** service that:

- loads a pretrained `ResNet18`
- downloads and caches demo source images
- applies an FGSM perturbation to a sampled image
- returns:
  - the perturbed image
  - the human-correct label
  - the model-confused label
  - the epsilon used

This service is what makes HumanLock feel technically real instead of being a static mock.

There is also a local fixture fallback path in `lib/humanlock-fixtures.ts` for verification flows and demo resilience.

### 3. AgentPass challenge generation

`app/api/agentpass/challenge/route.ts` creates an obfuscated reasoning challenge. The system prompt asks the model to produce JSON containing:

- a clean source problem
- the correct answer
- a unit
- an obfuscated presentation of the problem

The obfuscation intentionally makes the challenge awkward for casual humans while still solvable by an actual reasoning model. This is the core "reverse CAPTCHA" mechanic.

The route prefers **K2** and falls back to **OpenAI** if K2 is unavailable or times out.

### 4. Agent fingerprinting and token issuance

`app/api/agentpass/verify/route.ts`:

- checks whether the submitted answer is correct
- normalizes units and numeric formatting
- uses response latency and proof-of-work timing as a coarse fingerprint
- emits a signed token for the verified agent
- tries to write a Solana memo transaction with model + confidence metadata

This is still heuristic and demo-oriented, but it shows the shape of an identity and reputation pipeline for agents.

### 5. Demo automation

The `demo/` directory contains Python scripts that use `browser-use`:

- `agent_humanlock.py` attempts to pass HumanLock and is expected to fail
- `agent_agentpass.py` attempts AgentPass and is expected to succeed
- `run_demo.sh` orchestrates both flows

This is important to the pitch: the project does not just talk about agent traffic, it actively tests itself against agent traffic.

### 6. Secondary frontend experiment

There is also a separate `frontend/` directory containing a TanStack/Vite implementation of similar UI ideas. The root Next.js app is the primary demo in this repository today; `frontend/` appears to be a parallel or earlier exploration rather than the main runtime path.

## Repo Structure

```text
.
├── app/                    # Next.js app router pages and API routes
├── components/aurora/      # Landing page and product demo UI
├── lib/                    # Shared utilities: Solana, K2, fixtures, API helpers
├── fgsm-service/           # FastAPI adversarial-image sidecar
├── demo/                   # Browser-use automation demos
├── public/                 # Static assets and worker scripts
├── frontend/               # Alternate frontend experiment
├── DEMO.md                 # Short demo run instructions
└── start.sh                # Convenience script for FGSM service + Next dev server
```

## End-to-End Flows

### HumanLock flow

1. Client requests `/api/humanlock/challenge`.
2. Next.js calls the FGSM service.
3. FGSM service returns a perturbed image challenge.
4. User selects a label.
5. Client sends:
   - selected answer
   - mouse path points
   - click timing
   - tremor score
6. Server computes a score from correctness + behavior.
7. On success, server returns a signed human token.

### AgentPass flow

1. Client requests `/api/agentpass/challenge`.
2. Server asks K2 for an obfuscated math challenge.
3. If K2 fails, server falls back to OpenAI.
4. Client starts proof-of-work in `public/pow-worker.js`.
5. Agent solves the obfuscated challenge.
6. Client submits:
   - answer
   - response latency
   - proof-of-work duration
7. Server verifies correctness, assigns a rough fingerprint, signs an agent token, and optionally writes a Solana memo.

## Environment Variables

### Core app

- `K2_API_KEY` -> required for AgentPass primary challenge generation
- `OPENAI_API_KEY` -> optional fallback for AgentPass
- `K2_BASE_URL` -> defaults to `https://api.k2think.ai/v1`
- `K2_MODEL` -> defaults to `MBZUAI-IFM/K2-Think-v2`
- `OPENAI_BASE_URL` -> defaults to `https://api.openai.com/v1`
- `OPENAI_MODEL` -> defaults to `gpt-4o-mini`
- `AGENTPASS_K2_TIMEOUT_MS` -> request timeout for challenge generation
- `FGSM_SERVICE_URL` -> defaults to `http://127.0.0.1:8001`
- `HUMANLOCK_ALLOW_FIXTURE_FALLBACK` -> defaults to `false` in local development and `true` in production
- `TOKEN_SECRET` -> HMAC secret used for signing returned tokens
- `SOLANA_PRIVATE_KEY` -> optional JSON array secret key for Solana devnet memo writes

### Demo automation

- `DEMO_BASE_URL` -> base URL for `/demo`
- `BROWSER_USE_USE_CLOUD` -> set to `true` for Browser Use cloud mode
- `BROWSER_USE_API_KEY` -> required in cloud mode
- `BROWSER_USE_LLM_API_KEY` -> optional override for demo LLM provider
- `BROWSER_USE_LLM_BASE_URL` -> optional override for demo LLM base URL
- `BROWSER_USE_PRIMARY_MODEL` -> optional override for primary demo model
- `BROWSER_USE_FALLBACK_MODEL` -> optional override for fallback demo model

## Local Development

### Prerequisites

- Node.js / npm
- Python 3 with a virtual environment
- dependencies for both the Next.js app and the FGSM service

### 1. Install JavaScript dependencies

```bash
npm install
```

### 2. Create a Python environment for the FGSM service

```bash
python3 -m venv .venv-fgsm
source .venv-fgsm/bin/activate
pip install -r fgsm-service/requirements.txt
pip install -r requirements.txt
```

`requirements.txt` at the repo root is for the browser automation demo. `fgsm-service/requirements.txt` is for the adversarial image server.

### 3. Configure environment

Create `.env.local` in the project root with at least:

```bash
K2_API_KEY=...
OPENAI_API_KEY=...
TOKEN_SECRET=change-me
```

Optional for Solana reputation:

```bash
SOLANA_PRIVATE_KEY=[...]
```

### 4. Start the app

Convenience path:

```bash
bash start.sh
```

This starts the FGSM service and then starts the Next.js dev server.

Manual path:

```bash
cd fgsm-service
bash start.sh

cd ..
npm run dev
```

### 5. Open the app

Visit:

- `http://localhost:3000/`
- `http://localhost:3000/humanlock`
- `http://localhost:3000/agentpass`
- `http://localhost:3000/demo`
- `https://hack-tech-2026-2mbc.vercel.app/`

## Running the Demo Agents

After the app and FGSM service are up:

```bash
cd demo
bash run_demo.sh
```

Expected outcome:

- the HumanLock agent should be blocked or score poorly
- the AgentPass agent should solve the challenge and receive a verification payload

This is the clearest end-to-end proof that the dual-track design works.

## What Is Technically Interesting Here

This project combines several ideas that are usually built separately:

- **adversarial ML** for human-first verification
- **LLM-generated challenge design** for agent verification
- **behavioral telemetry** as a secondary signal
- **proof-of-work** as an anti-abuse cost
- **signed tokens** as a machine-readable output
- **on-chain reputation hooks** as a primitive for portable trust

The novelty is not any single piece. The novelty is the **system design**:

- humans and agents are treated as different first-class identities
- the verification mechanism changes based on which identity is expected
- the result of verification is durable, structured, and portable

That is what makes AURORA feel like an AI-native reinterpretation of account security rather than a standard CAPTCHA demo.

## Current Limitations

This is an MVP, not a production security product.

Known limitations:

- challenge state is stored in in-memory maps, not durable storage
- fingerprinting is heuristic, not model-grade attribution
- returned JWT-like tokens are custom-signed strings, not a full standards-compliant auth system
- HumanLock behavior scoring is intentionally lightweight
- Solana integration writes memo-style reputation records, not transferable credentials
- the demo assumes cooperative local infrastructure and developer-controlled environment variables

## Why This Matters

The web is moving from a human-only surface to a mixed human/agent surface. Once that happens, identity can no longer be binary. "Bot or not" stops being enough.

AURORA proposes a different framing:

- **HumanLock** for "prove you are a person"
- **AgentPass** for "prove you are an allowed machine"

If Castle.io was born in 2026, this is the direction we believe it would need to go.

## Files Worth Reading First

- `app/api/humanlock/challenge/route.ts`
- `app/api/humanlock/verify/route.ts`
- `app/api/agentpass/challenge/route.ts`
- `app/api/agentpass/verify/route.ts`
- `fgsm-service/server.py`
- `components/aurora/HumanLockDemo.tsx`
- `components/aurora/AgentPassDemo.tsx`
- `demo/run_demo.sh`

## One-Line Summary

**AURORA is a reimagined 2026 version of Castle.io: not just blocking bad bots, but separating humans, hostile automation, and trusted agents with different verification paths and signed outcomes.**
