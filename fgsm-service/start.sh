#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PID_FILE=/tmp/janus-fgsm.pid
LOG_FILE=/tmp/janus-fgsm.log
HOST=${FGSM_HOST:-127.0.0.1}
PORT=${FGSM_PORT:-8001}

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
    echo "FGSM service already running on pid $PID"
    echo "Log: $LOG_FILE"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if [ -x "$ROOT_DIR/../.venv-fgsm/bin/python" ]; then
  PYTHON_BIN="$ROOT_DIR/../.venv-fgsm/bin/python"
elif [ -x "$ROOT_DIR/../.venv/bin/python" ]; then
  PYTHON_BIN="$ROOT_DIR/../.venv/bin/python"
else
  echo "No project virtualenv found. Expected .venv-fgsm or .venv."
  exit 1
fi

cd "$ROOT_DIR"
nohup env PYTHONUNBUFFERED=1 "$PYTHON_BIN" -m uvicorn server:app --host "$HOST" --port "$PORT" >"$LOG_FILE" 2>&1 &
PID=$!
echo "$PID" >"$PID_FILE"

STARTED=false
ATTEMPT=0
while [ "$ATTEMPT" -lt 30 ]; do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "FGSM service failed to start."
    cat "$LOG_FILE" 2>/dev/null || true
    rm -f "$PID_FILE"
    exit 1
  fi

  if command -v curl >/dev/null 2>&1 && curl -fsS "http://$HOST:$PORT/healthz" >/dev/null 2>&1; then
    STARTED=true
    break
  fi

  ATTEMPT=$((ATTEMPT + 1))
  sleep 1
done

if [ "$STARTED" != "true" ]; then
  echo "FGSM service did not become healthy."
  cat "$LOG_FILE" 2>/dev/null || true
  rm -f "$PID_FILE"
  exit 1
fi

echo "FGSM service started on http://$HOST:$PORT"
echo "PID: $PID"
echo "Log: $LOG_FILE"
