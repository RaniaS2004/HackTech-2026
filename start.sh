#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)

"$ROOT_DIR/fgsm-service/start.sh"
cd "$ROOT_DIR"
npm run dev
