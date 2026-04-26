import asyncio
import re
from backboard import BackboardClient

async def main():
    client = BackboardClient(api_key="espr_9dvmIADLXN7JuiWOqw52ktHNCHmQJmMnhAwrGRst1Ew")
    bot = await client.create_assistant(
        name="JANUS Reputation Tracker",
        system_prompt="You track AI agent verification history and reputation scores.",
    )
    aid = bot.assistant_id
    print(f"REPUTATION_ASSISTANT_ID={aid}")

    # Write ID into .env.local
    env_path = ".env.local"
    with open(env_path, "r") as f:
        content = f.read()
    content = re.sub(r"REPUTATION_ASSISTANT_ID=.*", f"REPUTATION_ASSISTANT_ID={aid}", content)
    with open(env_path, "w") as f:
        f.write(content)
    print(".env.local updated.")

asyncio.run(main())
