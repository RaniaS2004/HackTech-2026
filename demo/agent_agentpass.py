import asyncio

from browser_use import Agent

from browser_use_demo import get_demo_url, run_with_retries


async def main():
    demo_url = get_demo_url()

    def build_agent(browser_session, llm, fallback_llm):
        return Agent(
            task=f"""
Go to {demo_url}.

Pass the AGENTPASS CHALLENGE with the fewest possible actions.

Rules:
- Use only these stable ids: challenge-plain, pow-status, agent-answer, agentpass-solve, agentpass-result.
- Read the exact math problem from challenge-plain.
- Solve it exactly.
- Wait until pow-status says the proof of work is solved.
- Enter only the final numeric answer in agent-answer.
- Click agentpass-solve once.
- Read agentpass-result and report the full JSON, including passed, model fingerprint, confidence score, and transaction link if present.
- Stop as soon as you have the final result.
""",
            llm=llm,
            fallback_llm=fallback_llm,
            browser_session=browser_session,
            use_vision=False,
        )

    result = await run_with_retries("AGENTPASS", build_agent, max_steps=12, attempts=3, retry_delay_seconds=6)
    print("AGENTPASS AGENT RESULT:")
    print(result)


asyncio.run(main())
