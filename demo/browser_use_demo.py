import asyncio
import os
from typing import Awaitable, Callable
from urllib.parse import urlparse

from browser_use import Agent, BrowserSession, ChatOpenAI


DEFAULT_LOCAL_BASE_URL = "http://localhost:3000"
DEFAULT_K2_BASE_URL = "https://api.k2think.ai/v1"
DEFAULT_K2_MODEL = "MBZUAI-IFM/K2-Think-v2"
TRANSIENT_ERROR_MARKERS = (
    "502",
    "503",
    "504",
    "bad gateway",
    "gateway",
    "timeout",
    "rate limit",
    "too many requests",
    "connection reset",
    "temporarily unavailable",
)


def is_cloud_mode() -> bool:
    return os.environ.get("BROWSER_USE_USE_CLOUD", "").lower() == "true"


def get_demo_url() -> str:
    base_url = os.environ.get("DEMO_BASE_URL", DEFAULT_LOCAL_BASE_URL).rstrip("/")
    return f"{base_url}/demo"


def get_models() -> tuple[str, str]:
    primary = os.environ.get("BROWSER_USE_PRIMARY_MODEL") or os.environ.get("K2_MODEL", DEFAULT_K2_MODEL)
    fallback = os.environ.get("BROWSER_USE_FALLBACK_MODEL") or primary
    return primary, fallback


def get_llm_base_url() -> str:
    return os.environ.get("BROWSER_USE_LLM_BASE_URL") or os.environ.get("K2_BASE_URL", DEFAULT_K2_BASE_URL)


def get_llm_api_key() -> str | None:
    return os.environ.get("BROWSER_USE_LLM_API_KEY") or os.environ.get("K2_API_KEY")


def validate_environment() -> None:
    if not get_llm_api_key():
        raise RuntimeError("K2_API_KEY is required for the Browser Use LLM. Set BROWSER_USE_LLM_API_KEY only if overriding the provider.")

    if is_cloud_mode() and not os.environ.get("BROWSER_USE_API_KEY"):
        raise RuntimeError("BROWSER_USE_API_KEY is required when BROWSER_USE_USE_CLOUD=true.")

    demo_url = get_demo_url()
    parsed = urlparse(demo_url)
    if not parsed.scheme or not parsed.netloc:
        raise RuntimeError(f"Invalid DEMO_BASE_URL: {demo_url}")

    if is_cloud_mode() and parsed.hostname in {"localhost", "127.0.0.1"}:
        raise RuntimeError(
            "Browser Use cloud mode cannot reach localhost. Set DEMO_BASE_URL to a public HTTPS URL or disable BROWSER_USE_USE_CLOUD."
        )


def create_browser_session() -> BrowserSession:
    if is_cloud_mode():
        return BrowserSession(use_cloud=True, cloud_timeout=15)
    return BrowserSession(headless=False)


def create_llms() -> tuple[ChatOpenAI, ChatOpenAI]:
    primary_model, fallback_model = get_models()
    api_key = get_llm_api_key()
    base_url = get_llm_base_url()
    primary = ChatOpenAI(model=primary_model, api_key=api_key, base_url=base_url, max_completion_tokens=900)
    fallback = ChatOpenAI(model=fallback_model, api_key=api_key, base_url=base_url, max_completion_tokens=500)
    return primary, fallback


def print_run_header(name: str) -> None:
    mode = "cloud" if is_cloud_mode() else "local"
    primary_model, fallback_model = get_models()
    print(
        f"[{name}] mode={mode} url={get_demo_url()} "
        f"llm_base_url={get_llm_base_url()} primary_model={primary_model} fallback_model={fallback_model}"
    )


def is_transient_error(error: Exception) -> bool:
    message = str(error).lower()
    return any(marker in message for marker in TRANSIENT_ERROR_MARKERS)


async def run_with_retries(
    name: str,
    build_agent: Callable[[BrowserSession, ChatOpenAI, ChatOpenAI], Agent],
    *,
    max_steps: int,
    attempts: int = 2,
    retry_delay_seconds: int = 5,
) -> str:
    validate_environment()
    print_run_header(name)

    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        browser_session = create_browser_session()
        try:
            llm, fallback_llm = create_llms()
            agent = build_agent(browser_session, llm, fallback_llm)
            history = await agent.run(max_steps=max_steps)
            result = history.final_result() or ""
            print(f"[{name}] completed on attempt {attempt}/{attempts}")
            return result
        except Exception as error:
            last_error = error
            print(f"[{name}] attempt {attempt}/{attempts} failed: {error}")
            if attempt >= attempts or not is_transient_error(error):
                break
            await asyncio.sleep(retry_delay_seconds)
        finally:
            await _safe_close(browser_session)

    raise RuntimeError(f"{name} failed after {attempts} attempt(s): {last_error}") from last_error


async def _safe_close(browser_session: BrowserSession) -> None:
    close = getattr(browser_session, "close", None)
    if close is None:
        return
    maybe_awaitable = close()
    if isinstance(maybe_awaitable, Awaitable):
        await maybe_awaitable
