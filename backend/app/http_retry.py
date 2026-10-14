"""One retry for outgoing HTTP calls that fail on a broken connection.

Lambda pauses the backend between requests, and a connection to Supabase or ElevenLabs can be
dropped or reset in the meantime. Those failures happen before the other side has answered, so
sending the same request once more on a fresh connection is safe and usually succeeds.
Timeouts are not retried: the request may still be running, and a second wait could push a
voice turn past Lambda's 30-second limit.
"""

import logging
from collections.abc import Callable

import httpx

logger = logging.getLogger("naviglot.http")

RETRYABLE_ERRORS = (httpx.NetworkError, httpx.RemoteProtocolError)


def send_with_retry(send: Callable[[], httpx.Response], service: str) -> httpx.Response:
    """Calls `send()`, and once more if the connection broke. Other errors propagate unchanged."""
    try:
        return send()
    except RETRYABLE_ERRORS as error:
        logger.warning("%s connection failed (%s: %s), retrying once", service, type(error).__name__, error)
        return send()
