1. Start FGSM service: cd fgsm-service && bash start.sh
2. Start Next.js: npm run dev
3. Open http://localhost:3000/demo in browser
4. Default mode is local visible Chromium. In a second terminal: cd demo && bash run_demo.sh
5. Optional cloud mode requires a public URL. Set `DEMO_BASE_URL=https://your-public-demo-url`, `BROWSER_USE_USE_CLOUD=true`, and `BROWSER_USE_API_KEY=...` in `.env.local`.
6. Optional model overrides: `BROWSER_USE_PRIMARY_MODEL=gpt-4o` and `BROWSER_USE_FALLBACK_MODEL=gpt-4o-mini`.
7. Watch the local browser window in default mode, or the Browser Use dashboard in cloud mode.
