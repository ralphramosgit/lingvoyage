"""Ask the backend for a city's pack and watch it build, the way the app will (issue #38).

Run from backend/ with the virtual environment active:

    python scripts/try_packs.py chengdu                    # local uvicorn (http://127.0.0.1:8000)
    python scripts/try_packs.py chengdu --api https://xxxx.lambda-url.us-west-2.on.aws

Signs in with a Lingvoyage account (asks for the password; nothing is stored). A city that's
already built answers straight away and costs nothing. A new city starts a real run (about $4,
about 5 minutes). Ctrl+C stops watching; the run carries on.
"""

import argparse
import getpass
import os
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx  # noqa: E402

from app.config import get_settings  # noqa: E402

POLL_SECONDS = 3


def sign_in(email: str, password: str) -> str:
    settings = get_settings()
    response = httpx.post(
        f"{settings.supabase_url}/auth/v1/token",
        params={"grant_type": "password"},
        headers={"apikey": settings.supabase_publishable_key},
        json={"email": email, "password": password},
        timeout=15.0,
    )
    if response.status_code != 200:
        sys.exit(f"Sign-in failed (HTTP {response.status_code}). Check the email and password.")
    return response.json()["access_token"]


def call(client: httpx.Client, method: str, path: str) -> dict[str, Any]:
    response = client.request(method, path)
    body = response.json()
    if response.status_code >= 400:
        error = body.get("error", {})
        sys.exit(f"{method} {path}: HTTP {response.status_code} {error.get('code')}: {error.get('message')}")
    return body


def show(status: dict[str, Any], seen: set[tuple[str, str, str]]) -> None:
    for step in status["steps"]:
        key = (step["t"], step.get("worker") or "", step["text"])
        if key in seen:
            continue
        seen.add(key)
        print(f"  {step['stage']:<9} {step.get('worker') or '':<24} {step['kind']:<6} {step['text']}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Ask for a city's pack and watch it build.")
    parser.add_argument("city", help="a city slug, e.g. chengdu")
    parser.add_argument("--api", default="http://127.0.0.1:8000", help="the backend (default: local uvicorn)")
    parser.add_argument("--email", default=os.environ.get("LINGVOYAGE_TEST_EMAIL"), help="a Lingvoyage account")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    email = args.email or input("Email: ")
    token = sign_in(email, getpass.getpass("Password: "))
    headers = {"Authorization": f"Bearer {token}"}
    with httpx.Client(base_url=args.api.rstrip("/"), headers=headers, timeout=30.0) as client:
        status = call(client, "POST", f"/packs/{args.city}")
        print(f"\nPOST /packs/{args.city}: {status['status']}" + (" (refreshing)" if status["refreshing"] else ""))
        seen: set[tuple[str, str, str]] = set()
        try:
            while status["status"] in ("queued", "running"):
                show(status, seen)
                time.sleep(POLL_SECONDS)
                status = call(client, "GET", f"/packs/{args.city}/status")
        except KeyboardInterrupt:
            print("\nStopped watching. The run carries on.")
            return 0
        show(status, seen)

        counts = status["counts"]
        print(f"\nStatus: {status['status']} · {counts['facts']} facts · {counts['places']} places · {counts['sources']} sources")
        if status["error"]:
            print(f"Error: {status['error']['code']}: {status['error']['message']}")
        if status["status"] != "ready":
            return 1

        pack = call(client, "GET", f"/packs/{args.city}")
        print(
            f"Pack {pack['id']}, built {pack['built_at']}: {len(pack['encounters'])} encounters, "
            f"{len(pack['unit_notes'])} units with notes, {len(pack['quizzes'])} quizzes, {len(pack['sources'])} sources"
        )
        for source in pack["sources"][:5]:
            print(f"  {source['title'][:70]}  {source['url']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
