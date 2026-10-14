"""One retry for outgoing HTTP calls that fail on a broken or stuck connection.

Lambda pauses the backend between requests, and a connection to Supabase or ElevenLabs can be
dropped or reset in the meantime. Those failures happen before the other side has answered, so
sending the same request once more on a fresh connection is safe and usually succeeds.

Timeouts are only retried when the caller opts in (the Supabase login check, which is quick and
changes nothing). Voice calls don't: a second long wait could push a voice turn past Lambda's
30-second limit, and ElevenLabs may already be working on the first request.
"""

import logging
from collections.abc import Callable

import httpx

logger = logging.getLogger("naviglot.http")

RETRYABLE_ERRORS: tuple[type[httpx.HTTPError], ...] = (httpx.NetworkError, httpx.RemoteProtocolError)
RETRYABLE_ERRORS_AND_TIMEOUTS = (*RETRYABLE_ERRORS, httpx.TimeoutException)


def send_with_retry(
    send: Callable[[], httpx.Response],
    service: str,
    retry_on: tuple[type[httpx.HTTPError], ...] = RETRYABLE_ERRORS,
) -> httpx.Response:
    """Calls `send()`, and once more if it failed with one of `retry_on`. Other errors propagate."""
    try:
        return send()
    except retry_on as error:
        logger.warning("%s request failed (%s: %s), retrying once", service, type(error).__name__, error)
        return send()
