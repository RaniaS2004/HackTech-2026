#!/bin/sh
set -e
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8001 --reload
