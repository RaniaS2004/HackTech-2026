1. Start FGSM service: cd fgsm-service && bash start.sh
2. Start Next.js: npm run dev
3. Open http://localhost:3000/demo in browser
4. Set `K2_API_KEY=...` in `.env.local` or in the shell running the demo.
5. Default mode is local visible Chromium. In a second terminal: cd demo && bash run_demo.sh
6. Optional cloud mode requires a public URL. Set `DEMO_BASE_URL=https://your-public-demo-url`, `BROWSER_USE_USE_CLOUD=true`, and `BROWSER_USE_API_KEY=...` in `.env.local`.
7. AgentPass now requires K2. Optional overrides: `K2_MODEL=MBZUAI-IFM/K2-Think-v2`, `K2_BASE_URL=https://api.k2think.ai/v1`, and `AGENTPASS_K2_TIMEOUT_MS=180000`.
8. Watch the local browser window in default mode, or the Browser Use dashboard in cloud mode.
