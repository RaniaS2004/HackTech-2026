#!/bin/bash
set -e
source ../.venv-fgsm/bin/activate
set -a
source ../.env.local
set +a

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "OPENAI_API_KEY is required."
  exit 1
fi

if [ "${BROWSER_USE_USE_CLOUD:-false}" = "true" ] && [ -z "${BROWSER_USE_API_KEY:-}" ]; then
  echo "BROWSER_USE_API_KEY is required when BROWSER_USE_USE_CLOUD=true."
  exit 1
fi

if [ "${BROWSER_USE_USE_CLOUD:-false}" = "true" ]; then
  if [ -z "${DEMO_BASE_URL:-}" ]; then
    echo "DEMO_BASE_URL is required when BROWSER_USE_USE_CLOUD=true."
    exit 1
  fi

  if [ "${DEMO_BASE_URL}" = "http://localhost:3000" ] || [ "${DEMO_BASE_URL}" = "http://127.0.0.1:3000" ]; then
    echo "Cloud mode cannot use localhost. Set DEMO_BASE_URL to your public deployed URL."
    exit 1
  fi
fi

echo "============================================"
echo "JANUS LIVE AGENT DEMO"
echo "============================================"
echo ""
if [ "${BROWSER_USE_USE_CLOUD:-false}" = "true" ]; then
  echo "Browser Use cloud mode enabled."
  echo "Demo URL: ${DEMO_BASE_URL:-unset}"
  echo "Cloud browser requires a public URL."
else
  echo "Browser Use local visible Chromium mode detected."
  echo "Demo URL: ${DEMO_BASE_URL:-http://localhost:3000}"
fi
echo ""
echo "Running Agent 1: Attempting to pass HumanLock..."
echo "Expected result: BLOCKED (bot-like behavior)"
echo ""
python3 agent_humanlock.py
echo ""
echo "============================================"
echo ""
sleep 2
echo "Running Agent 2: Hitting AgentPass..."
echo "Expected result: VERIFIED + model fingerprinted"
echo ""
python3 agent_agentpass.py
echo ""
echo "============================================"
echo "Demo complete."
