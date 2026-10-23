"""Recherche multi-sites allemands (mobile.de, AutoScout24, kleinanzeigen) via
Apify, en parallele. Sortie mappee en Candidate commun, re-filtree sur les
criteres, agregee. Classement dans engine.ranking."""
from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from ...config import settings
from ...market_types import Candidate

_ACTORS = {
    "mobile_de": "topapi~mobile-de-listings-scraper",
    "autoscout24": "crawloop~autoscout24-scraper",
    "kleinanzeigen": "benthepythondev~kleinanzeigen-autos-scraper",
}

_FUEL = {"diesel": "diesel", "benzin": "essence", "petrol": "essence",
         "elektro": "electrique", "electric": "electrique",
         "hybrid": "hybride", "lpg": "gpl"}


def _num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return int(v)
    d = re.sub(r"[^\d]", "", str(v))
    return int(d) if d else None


def _year(v):
    if v is None:
        return None
    m = re.search(r"(19|20)\d{2}", str(v))
    return int(m.group(0)) if m else None


def _first(item: dict, *keys):
    for k in keys:
        if k in item and item[k] not in (None, ""):
            return item[k]
    return None


def to_candidate(item: dict) -> Candidate | None:
    prix = _num(_first(item, "price", "priceEur", "grossPrice", "preis"))
    km = _num(_first(item, "mileageKm", "mileage", "km", "kilometer"))
    an = _year(_first(item, "firstRegistration", "firstRegistrationDate",
                      "year", "registration", "erstzulassung"))
    if not prix or not km or not an:
        return None

    hu = str(_first(item, "huStatus", "hu", "tuv", "huValidUntil") or "").strip().lower()
    hu_ok = None
    if hu:
        if any(w in hu for w in ("fällig", "faellig", "due", "expired", "abgelaufen")):
            hu_ok = False
        elif (any(w in hu for w in ("new", "neu", "gültig", "gueltig", "valid"))
              or re.search(r"\d{4}", hu)):
            hu_ok = True

    seller = _first(item, "sellerType", "seller_type", "sellerKind")
    if seller is None:
        s = item.get("seller")
        if isinstance(s, dict):
            seller = s.get("type") or s.get("kind")

    hd = _first(item, "hasDamage", "isDamageCase", "accident")
    fuel = str(_first(item, "fuelType", "fuel", "kraftstoff") or "").lower()
    return Candidate(
        source="?", url=_first(item, "url", "link"),
        titre=_first(item, "title", "titre", "name"),
        prix_eur=float(prix), km=km, annee=an,
        carburant=_FUEL.get(fuel, fuel or None),
        puissance_kw=_num(_first(item, "powerKw", "powerKW", "leistung")),
        price_rating=_first(item, "priceRating"),
        has_damage=hd if isinstance(hd, bool) else None, hu_ok=hu_ok,
        seller_type=(str(seller).lower() if seller else None),
        previous_owners=_num(_first(item, "previousOwners", "numberOfPreviousOwners",
                                    "owners", "vorbesitzer")),
        co2_gkm=_num(_first(item, "co2Emissions", "co2")),
        masse_kg=_num(_first(item, "weightKg", "weight")),
    )


def _payload(source, make, model, price_max, year_min, km_max, max_results):
    base = {"proxyConfiguration": {"useApifyProxy": True}}
    if source == "mobile_de":
        p = {**base, "make": make, "model": model, "maxResults": max_results}
        if price_max: p["priceMax"] = price_max
        if year_min: p["yearMin"] = year_min
        if km_max: p["mileageMax"] = km_max
        return p
    if source == "autoscout24":
        p = {**base, "make": make, "model": model, "maxItems": max_results}
        if price_max: p["maxPrice"] = price_max
        if year_min: p["minYear"] = year_min
        if km_max: p["maxMileage"] = km_max
        return p
    return {**base, "keyword": f"{make} {model}", "maxResults": max_results}


def _post(actor: str, payload: dict, timeout: int = 300) -> list[dict]:
    token = settings.apify_token
    if not token:
        raise ValueError("VERDICT_APIFY_TOKEN manquant dans .env")
    url = (f"https://api.apify.com/v2/acts/{actor}"
           f"/run-sync-get-dataset-items?token={token}")
    req = Request(url, data=json.dumps(payload).encode("utf-8"),
                  headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", errors="ignore"))
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")[:300]
        raise RuntimeError(f"{actor} HTTP {e.code} : {body}") from None


def _passes(c: Candidate, price_max, year_min, km_max, fuel_types) -> bool:
    if price_max and c.prix_eur > price_max:
        return False
    if year_min and c.annee < year_min:
        return False
    if km_max and c.km > km_max:
        return False
    if fuel_types and c.carburant not in fuel_types:
        return False
    return True


def search_source(source, make, model, price_max=None, year_min=None,
                  km_max=None, fuel_types=None, max_results=40) -> list[Candidate]:
    items = _post(_ACTORS[source],
                  _payload(source, make, model, price_max, year_min, km_max, max_results))
    out: list[Candidate] = []
    for it in items:
        c = to_candidate(it)
        if c and _passes(c, price_max, year_min, km_max, fuel_types):
            c.source = source
            out.append(c)
    return out


def search_all(make, model, price_max=None, year_min=None, km_max=None,
               fuel_types=None, max_results=40,
               sources=None) -> tuple[list[Candidate], dict]:
    sources = sources or list(_ACTORS)
    allc: list[Candidate] = []
    errors: dict = {}
    with ThreadPoolExecutor(max_workers=max(1, len(sources))) as ex:
        futs = {ex.submit(search_source, s, make, model, price_max, year_min,
                          km_max, fuel_types, max_results): s for s in sources}
        for fut in as_completed(futs):
            s = futs[fut]
            try:
                allc.extend(fut.result())
            except Exception as e:
                errors[s] = str(e)
    return allc, errors
