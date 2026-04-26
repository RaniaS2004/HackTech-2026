#!/bin/bash
set -e
VENV_PATH="../.venv-fgsm"
if [ ! -f "${VENV_PATH}/bin/activate" ] && [ -f "../fgsm-service/.venv-fgsm/bin/activate" ]; then
  VENV_PATH="../fgsm-service/.venv-fgsm"
fi

if [ ! -f "${VENV_PATH}/bin/activate" ]; then
  echo "Python virtualenv not found. Install requirements into .venv-fgsm first."
  exit 1
fi

source "${VENV_PATH}/bin/activate"
if [ -f ../.env.local ]; then
  set -a
  source ../.env.local
  set +a
fi

: "${K2_BASE_URL:=https://api.k2think.ai/v1}"
: "${K2_MODEL:=MBZUAI-IFM/K2-Think-v2}"
: "${BROWSER_USE_LLM_BASE_URL:=${K2_BASE_URL}}"
: "${BROWSER_USE_PRIMARY_MODEL:=${K2_MODEL}}"
: "${BROWSER_USE_FALLBACK_MODEL:=${BROWSER_USE_PRIMARY_MODEL}}"
export K2_BASE_URL K2_MODEL BROWSER_USE_LLM_BASE_URL BROWSER_USE_PRIMARY_MODEL BROWSER_USE_FALLBACK_MODEL

if [ -z "${K2_API_KEY:-}" ] && [ -z "${BROWSER_USE_LLM_API_KEY:-}" ]; then
  echo "K2_API_KEY is required for the Browser Use LLM."
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
echo "LLM base URL: ${BROWSER_USE_LLM_BASE_URL}"
echo "Primary model: ${BROWSER_USE_PRIMARY_MODEL}"
echo "Fallback model: ${BROWSER_USE_FALLBACK_MODEL}"
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
