"""Source mobile.de via acteur Apify (proxys inclus, renvoie du JSON).
Mapping defensif : les noms de champs de sortie ne sont pas documentes,
on tente plusieurs cles usuelles et on expose aussi les items bruts."""
from __future__ import annotations

import json
import re
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from ...config import settings
from ...contracts import Pays
from ...market_types import Comparable, SearchCriteria

SOURCE = "mobile_de"
ACTOR = "topapi~mobile-de-listings-scraper"
ENDPOINT = (f"https://api.apify.com/v2/actors/{ACTOR}"
            f"/run-sync-get-dataset-items")

_FUEL = {"diesel": "diesel", "benzin": "essence", "petrol": "essence",
         "elektro": "electrique", "electric": "electrique", "hybrid": "hybride"}


def _num(v) -> int | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return int(v)
    d = re.sub(r"[^\d]", "", str(v))
    return int(d) if d else None


def _year(v) -> int | None:
    if v is None:
        return None
    m = re.search(r"(19|20)\d{2}", str(v))
    return int(m.group(0)) if m else None


def _first(item: dict, *keys):
    for k in keys:
        if k in item and item[k] not in (None, ""):
            return item[k]
    return None


def run_actor(criteria: SearchCriteria, max_results: int = 50,
              timeout: int = 300) -> list[dict]:
    token = settings.apify_token
    if not token:
        raise ValueError("VERDICT_APIFY_TOKEN manquant dans .env")
    payload = {
        "make": criteria.marque,
        "model": criteria.modele,
        "maxResults": max_results,
        "proxyConfiguration": {"useApifyProxy": True},
    }
    data = json.dumps(payload).encode("utf-8")
    req = Request(f"{ENDPOINT}?token={token}", data=data,
                  headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", errors="ignore"))
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")[:400]
        raise RuntimeError(f"apify HTTP {e.code} : {body}") from None


def to_comparable(item: dict) -> Comparable | None:
    prix = _num(_first(item, "price", "priceEur", "price_eur", "grossPrice"))
    km = _num(_first(item, "mileage", "km", "kilometers", "mileageKm"))
    an = _year(_first(item, "firstRegistration", "year", "registration",
                      "firstRegistrationDate", "ez"))
    if not prix or not km or not an:
        return None
    fuel_raw = str(_first(item, "fuel", "fuelType", "fuel_type") or "").lower()
    return Comparable(
        source=SOURCE, url=_first(item, "url", "link"),
        prix_eur=float(prix), km=km, annee=an,
        motorisation=_FUEL.get(fuel_raw, fuel_raw or None), pays=Pays.de,
    )


def search(criteria: SearchCriteria, max_results: int = 50,
           **_kw) -> list[Comparable]:
    items = run_actor(criteria, max_results=max_results)
    return [c for it in items if (c := to_comparable(it))]
