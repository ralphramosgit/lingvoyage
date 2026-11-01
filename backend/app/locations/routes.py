"""Routes for local packs: the supported cities, and each city's pack (issue #34)."""

from collections.abc import Callable
from typing import TypeVar

from fastapi import APIRouter, Depends

from app.auth import AuthUser, require_user
from app.errors import ApiError
from app.locations import packs
from app.locations.cities import CITIES, City, find_city
from app.locations.store import PackStore, StoreError, get_store

T = TypeVar("T")

router = APIRouter()


def pack_store() -> PackStore:
    """The store these routes use. Tests swap in an in-memory one."""
    return get_store()


def _city_or_404(slug: str) -> City:
    city = find_city(slug)
    if city is None:
        raise ApiError(404, "city_not_found", f"We don't have local packs for '{slug}' yet.")
    return city


def _from_store(call: Callable[[], T]) -> T:
    try:
        return call()
    except StoreError as error:
        raise ApiError(503, "packs_unavailable", "Couldn't load city packs right now. Try again in a moment.") from error


@router.get("/cities", response_model=list[City])
def list_cities() -> list[City]:
    return CITIES


@router.post("/packs/{city}", response_model=packs.PackStatus)
def ensure_pack(
    city: str, user: AuthUser = Depends(require_user), store: PackStore = Depends(pack_store)
) -> packs.PackStatus:
    """Returns the city's pack status, starting a run if there's no pack yet (or it has expired)."""
    found = _city_or_404(city)
    return _from_store(lambda: packs.ensure_pack(store, found, user.id))


@router.get("/packs/{city}/status", response_model=packs.PackStatus)
def pack_status(
    city: str, _user: AuthUser = Depends(require_user), store: PackStore = Depends(pack_store)
) -> packs.PackStatus:
    """For polling while a pack builds: never starts anything."""
    found = _city_or_404(city)
    return _from_store(lambda: packs.pack_status(store, found))


@router.get("/packs/{city}", response_model=packs.LocalPack)
def get_pack(city: str, _user: AuthUser = Depends(require_user), store: PackStore = Depends(pack_store)) -> packs.LocalPack:
    found = _city_or_404(city)
    return _from_store(lambda: packs.local_pack(store, found))
