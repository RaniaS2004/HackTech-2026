import asyncio

from browser_use import Agent

from browser_use_demo import get_demo_url, run_with_retries


async def main():
    demo_url = get_demo_url()

    def build_agent(browser_session, llm, fallback_llm):
        return Agent(
            task=f"""
Go to {demo_url}.

Attempt the HUMANLOCK CHALLENGE and stop after the first submitted result.

Rules:
- Inspect the image under the HUMANLOCK section.
- Choose the matching button once using its stable id like choice-cat or choice-dog.
- Before submitting, move the mouse in the image area in a human-looking way.
- Click humanlock-submit once.
- Read humanlock-result and report the full JSON, especially passed and score.
- Stop as soon as you have the final result.
""",
            llm=llm,
            fallback_llm=fallback_llm,
            browser_session=browser_session,
            vision_detail_level="low",
        )

    result = await run_with_retries("HUMANLOCK", build_agent, max_steps=10, attempts=2, retry_delay_seconds=4)
    print("HUMANLOCK AGENT RESULT:")
    print(result)


asyncio.run(main())
