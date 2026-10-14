"""Verifies the Supabase access token sent as `Authorization: Bearer <token>`.

The token is checked by asking Supabase Auth who it belongs to (GET /auth/v1/user),
which works whatever JWT signing method the project uses. Valid tokens are cached
in memory for a few minutes to keep latency down.
"""

import hashlib
import logging
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass

import httpx
from fastapi import Header

from app.config import get_settings
from app.errors import ApiError, missing_setting
from app.http_retry import RETRYABLE_ERRORS_AND_TIMEOUTS, send_with_retry

logger = logging.getLogger("naviglot.auth")

CACHE_TTL_SECONDS = 300
CACHE_MAX_ENTRIES = 512

# Supabase normally answers in well under a second. Two 5-second tries (the second on a fresh
# connection) keep the worst case at 10 seconds but get past a request that got stuck.
_http = httpx.Client(timeout=5.0)

# sha256(token) -> (user_id, expires_at). Hashed so raw tokens never sit in memory longer than needed.
_cache: "OrderedDict[str, tuple[str, float]]" = OrderedDict()
_cache_lock = threading.Lock()


@dataclass(frozen=True)
class AuthUser:
    id: str


def _unauthorized(message: str = "Please log in again.") -> ApiError:
    return ApiError(401, "unauthorized", message)


def _cache_get(key: str) -> str | None:
    with _cache_lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        user_id, expires_at = entry
        if expires_at < time.monotonic():
            del _cache[key]
            return None
        _cache.move_to_end(key)
        return user_id


def _cache_put(key: str, user_id: str) -> None:
    with _cache_lock:
        _cache[key] = (user_id, time.monotonic() + CACHE_TTL_SECONDS)
        _cache.move_to_end(key)
        while len(_cache) > CACHE_MAX_ENTRIES:
            _cache.popitem(last=False)


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()


def verify_token(token: str) -> AuthUser:
    key = hashlib.sha256(token.encode("utf-8")).hexdigest()
    cached = _cache_get(key)
    if cached:
        return AuthUser(id=cached)

    settings = get_settings()
    if not settings.supabase_url:
        raise missing_setting("SUPABASE_URL")
    if not settings.supabase_publishable_key:
        raise missing_setting("SUPABASE_PUBLISHABLE_KEY")

    try:
        response = send_with_retry(
            lambda: _http.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "apikey": settings.supabase_publishable_key,
                    "Authorization": f"Bearer {token}",
                },
            ),
            "Supabase Auth",
            retry_on=RETRYABLE_ERRORS_AND_TIMEOUTS,
        )
    except httpx.HTTPError:
        logger.exception("Could not reach Supabase Auth to verify a token")
        raise ApiError(503, "auth_unavailable", "Couldn't verify your login right now. Try again in a moment.")

    if response.status_code != 200:
        raise _unauthorized()

    try:
        user_id = response.json().get("id")
    except ValueError:
        user_id = None
    if not isinstance(user_id, str) or not user_id:
        raise _unauthorized()

    _cache_put(key, user_id)
    return AuthUser(id=user_id)


def require_user(authorization: str | None = Header(default=None)) -> AuthUser:
    """FastAPI dependency for private endpoints."""
    if not authorization:
        raise _unauthorized("Missing Authorization header.")
    scheme, _, token = authorization.partition(" ")
    token = token.strip()
    if scheme.lower() != "bearer" or not token:
        raise _unauthorized("Authorization header must be 'Bearer <access_token>'.")
    return verify_token(token)
