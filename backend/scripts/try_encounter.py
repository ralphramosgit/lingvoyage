"""Play an encounter in the terminal, through the same routes the app uses: typed turns, no voice.

Run from backend/ with the virtual environment active:

    python scripts/try_encounter.py local-chengdu-chen-mapo-tofu                 # local uvicorn
    python scripts/try_encounter.py local-chengdu-chen-mapo-tofu --api https://xxxx.lambda-url.us-west-2.on.aws

Type Chinese, pinyin or English and press Enter. An empty line ends the scene. Each turn is one
tutor call (Sonnet, about a cent) plus a voice line the script ignores.
"""

import argparse
import getpass
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx  # noqa: E402

from scripts.try_packs import call, sign_in  # noqa: E402


def show(reply: dict[str, Any]) -> None:
    if reply["learner_hanzi"]:
        print(f"  you said: {reply['learner_hanzi']}  {reply['learner_pinyin']}")
    if reply["feedback"]:
        print(f"  feedback: {reply['feedback']}")
    if reply["corrected_hanzi"]:
        print(f"  better:   {reply['corrected_hanzi']}  {reply['corrected_pinyin']}")
    print(f"\n{reply['hanzi']}\n{reply['pinyin']}\n{reply['english']}")
    for suggestion in reply["suggestions"]:
        print(f"  try: {suggestion['hanzi']}  {suggestion['pinyin']}  ({suggestion['english']})")


def main() -> int:
    parser = argparse.ArgumentParser(description="Play an encounter in the terminal.")
    parser.add_argument("scenario_id", help="e.g. local-chengdu-chen-mapo-tofu, or a built-in one like restaurant")
    parser.add_argument("--api", default="http://127.0.0.1:8000", help="the backend (default: local uvicorn)")
    parser.add_argument("--email", default=os.environ.get("LINGVOYAGE_TEST_EMAIL"), help="a Lingvoyage account")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    token = sign_in(args.email or input("Email: "), getpass.getpass("Password: "))
    headers = {"Authorization": f"Bearer {token}"}
    with httpx.Client(base_url=args.api.rstrip("/"), headers=headers, timeout=30.0) as client:
        response = client.post("/conversation/start", json={"scenario_id": args.scenario_id})
        if response.status_code >= 400:
            error = response.json().get("error", {})
            sys.exit(f"Couldn't start {args.scenario_id}: HTTP {response.status_code} {error.get('code')}: {error.get('message')}")
        reply = response.json()["reply"]
        show(reply)
        history = [{"role": "npc", "text": reply["hanzi"]}]
        completed: list[str] = []
        while not reply["scenario_complete"]:
            text = input("\n> ").strip()
            if not text:
                break
            body = {"scenario_id": args.scenario_id, "history": history, "completed_goal_ids": completed, "user_text": text}
            reply = client.post("/conversation/turn", json=body).json().get("reply")
            if reply is None:
                print("That turn failed; try again.")
                continue
            history += [{"role": "learner", "text": text}, {"role": "npc", "text": reply["hanzi"]}]
            completed = reply["completed_goal_ids"]
            show(reply)
            print(f"  goals done: {', '.join(completed) or 'none yet'}")
        print("\nScene complete!" if reply["scenario_complete"] else "\nStopped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
