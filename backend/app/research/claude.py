"""The Claude client for research, and the one streamed request every worker makes."""

import threading
from collections.abc import Callable
from typing import Any

import anthropic
from anthropic.types.beta import BetaContentBlock, BetaMessage

from app.config import get_settings
from app.errors import missing_setting

# A research request can run several searches before it returns, so a longer timeout than the
# tutor's. The SDK retries 429s, 5xx and dropped connections itself.
REQUEST_TIMEOUT_SECONDS = 180.0
MAX_RETRIES = 3
MAX_TOKENS = 16000
FALLBACK_BETA = "server-side-fallback-2026-07-01"

_client: anthropic.Anthropic | None = None
_client_lock = threading.Lock()


def get_client() -> anthropic.Anthropic:
    global _client
    with _client_lock:
        if _client is None:
            api_key = get_settings().anthropic_api_key
            if not api_key:
                raise missing_setting("ANTHROPIC_API_KEY")
            _client = anthropic.Anthropic(api_key=api_key, timeout=REQUEST_TIMEOUT_SECONDS, max_retries=MAX_RETRIES)
        return _client


def stream_message(
    client: anthropic.Anthropic,
    *,
    model: str,
    system: str,
    tools: list[dict[str, Any]],
    messages: list[dict[str, Any]],
    effort: str,
    on_block: Callable[[BetaContentBlock], None],
) -> BetaMessage:
    """One request, streamed so searches reach the trace as they happen. `on_block` gets each finished block."""
    with client.beta.messages.stream(
        model=model,
        max_tokens=MAX_TOKENS,
        system=system,
        tools=tools,  # type: ignore[arg-type]
        messages=messages,  # type: ignore[arg-type]
        output_config={"effort": effort},  # type: ignore[typeddict-item]
        # Caches the conversation so far: each turn of the loop pays full price only for what's new.
        cache_control={"type": "ephemeral"},
        # If the model declines a request, the server retries it on a substitute model.
        betas=[FALLBACK_BETA],
        fallbacks="default",
    ) as stream:
        for event in stream:
            if event.type == "content_block_stop":
                on_block(event.content_block)
        return stream.get_final_message()
