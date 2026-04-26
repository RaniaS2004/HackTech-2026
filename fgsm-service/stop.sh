#!/bin/sh
set -eu

PID_FILE=/tmp/janus-fgsm.pid

if [ ! -f "$PID_FILE" ]; then
  echo "FGSM service is not running."
  exit 0
fi

PID=$(cat "$PID_FILE" 2>/dev/null || true)
if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Stopped FGSM service pid $PID"
else
  echo "FGSM service pid file was stale."
fi

rm -f "$PID_FILE"

