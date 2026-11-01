"""The research worker Lambda, lingvoyage-research: builds a pack the API queued.

Same lambda.zip as the API, handler app.research.worker.handler, 10-minute timeout, and no
automatic retries: a failed run is marked failed, and the app can start another. The API invokes
it with {"pack_id": ..., "city": ...} (app/research/jobs.py). Locally, jobs.py calls
run_queued_pack in a thread instead.
"""

import logging
from typing import Any

from app.locations.store import PackStore, get_store
from app.research.pipeline import run_pack

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logging.getLogger().setLevel(logging.INFO)  # Lambda pre-installs a handler, so basicConfig may be a no-op there
logger = logging.getLogger("lingvoyage.research")


def run_queued_pack(store: PackStore, pack_id: str) -> dict[str, Any]:
    """Builds a queued pack. It's claimed first, so if the same run is delivered twice, the second does nothing."""
    pack = store.get_pack(pack_id)
    if pack is None or not store.claim_pack(pack_id):
        logger.warning("Pack %s isn't queued (%s); not building it", pack_id, pack.status if pack else "missing")
        return {"pack_id": pack_id, "status": "skipped"}

    logger.info("Building the %s pack %s", pack.city, pack_id)
    report = run_pack(pack.city, store, pack_id=pack.id)
    usage = report.usage or {}
    logger.info(
        "Pack %s for %s: %s%s, %s s, about $%s",
        pack_id,
        pack.city,
        report.status,
        f" ({report.error})" if report.error else "",
        round(sum(usage.get("seconds", {}).values())),
        usage.get("cost_usd_estimate"),
    )
    return {"pack_id": pack_id, "city": pack.city, "status": report.status, "error": report.error}


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    pack_id = event.get("pack_id") if isinstance(event, dict) else None
    if not isinstance(pack_id, str) or not pack_id:
        logger.error("Research worker started without a pack_id")
        return {"status": "ignored"}
    return run_queued_pack(get_store(), pack_id)
