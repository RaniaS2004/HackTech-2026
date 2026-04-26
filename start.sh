#!/bin/sh
set -e
cd fgsm-service
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8001 &
cd ..
npm run dev
