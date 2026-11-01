"""Starting a research run: the worker Lambda on AWS, or a background thread when running locally.

The API can't build a pack itself: its Lambda has a 30-second timeout and a pack takes minutes.
So it queues the pack and hands it to the worker, which builds it and marks it ready or failed.
"""

import json
import logging
import os
import threading
from functools import cache
from typing import Any

from app.config import get_settings
from app.errors import ApiError, missing_setting
from app.locations.models import Pack

logger = logging.getLogger("lingvoyage.research")


def start_run(pack: Pack) -> None:
    """Hands a queued pack to the worker and returns straight away."""
    name = get_settings().research_function_name
    if name:
        _invoke(name, pack)
    elif os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        # A thread can't outlive a request on Lambda: the function is frozen as soon as it answers.
        raise missing_setting("RESEARCH_FUNCTION_NAME")
    else:
        threading.Thread(target=_run_here, args=(pack.id,), name=f"research-{pack.city}", daemon=True).start()


@cache
def _lambda_client() -> Any:
    import boto3  # the Lambda runtime's own copy on AWS; requirements-dev.txt locally

    return boto3.client("lambda")


def _invoke(name: str, pack: Pack) -> None:
    payload = json.dumps({"pack_id": pack.id, "city": pack.city}).encode("utf-8")
    try:
        # "Event": run it asynchronously. AWS queues the event and answers at once.
        _lambda_client().invoke(FunctionName=name, InvocationType="Event", Payload=payload)
    except Exception as error:  # botocore's errors, without importing botocore everywhere
        logger.exception("Couldn't start the research worker %s for pack %s", name, pack.id)
        raise ApiError(503, "research_unavailable", "Couldn't start building the pack. Try again in a moment.") from error


def _run_here(pack_id: str) -> None:
    from app.locations.store import get_store
    from app.research.worker import run_queued_pack

    try:
        run_queued_pack(get_store(), pack_id)
    except Exception:
        logger.exception("Local research run for pack %s crashed", pack_id)
