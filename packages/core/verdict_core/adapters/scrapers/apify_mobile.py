"""Source mobile.de via acteur Apify (proxys inclus, JSON structure).
Mappe une annonce vers Comparable, et construit une entree d'evaluation
complete (identite + annonce + TCO pre-rempli) a partir des champs riches."""
from __future__ import annotations

import json
import re
from datetime import date
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from ...config import settings
from ...contracts import Pays
from ...market_types import Comparable, SearchCriteria

SOURCE = "mobile_de"
ACTOR = "topapi~mobile-de-listings-scraper"
ENDPOINT = f"https://api.apify.com/v2/actors/{ACTOR}/run-sync-get-dataset-items"

_FUEL = {"diesel": "diesel", "benzin": "essence", "petrol": "essence",
         "elektro": "electrique", "electric": "electrique",
         "hybrid": "hybride", "lpg": "gpl"}
_CARB = _FUEL
_BOITE = {"automatic": "automatique", "automatik": "automatique",
          "manual": "manuelle", "schaltgetriebe": "manuelle"}


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


def _annees_depuis(first_reg: str | None, today: date) -> float:
    if not first_reg:
        return 0.0
    s = str(first_reg)
    mo = re.search(r"(\d{4})-(\d{1,2})", s)
    if mo:
        y, m = int(mo.group(1)), int(mo.group(2))
    else:
        mo = re.search(r"(\d{1,2})/(\d{4})", s)
        if not mo:
            return 0.0
        m, y = int(mo.group(1)), int(mo.group(2))
    start = date(y, max(1, min(12, m)), 1)
    return round((today - start).days / 365.25, 2)


def run_actor(criteria: SearchCriteria, max_results: int = 50,
              timeout: int = 300) -> list[dict]:
    token = settings.apify_token
    if not token:
        raise ValueError("VERDICT_APIFY_TOKEN manquant dans .env")
    payload = {
        "make": criteria.marque, "model": criteria.modele,
        "maxResults": max_results,
        "proxyConfiguration": {"useApifyProxy": True},
    }
    req = Request(f"{ENDPOINT}?token={token}",
                  data=json.dumps(payload).encode("utf-8"),
                  headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", errors="ignore"))
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")[:400]
        raise RuntimeError(f"apify HTTP {e.code} : {body}") from None


def to_comparable(item: dict) -> Comparable | None:
    prix = _num(_first(item, "price", "priceEur", "grossPrice"))
    km = _num(_first(item, "mileageKm", "mileage", "km"))
    an = _year(_first(item, "firstRegistration", "firstRegistrationDate", "year"))
    if not prix or not km or not an:
        return None
    fuel = str(_first(item, "fuelType", "fuel") or "").lower()
    return Comparable(
        source=SOURCE, url=_first(item, "url", "link"),
        prix_eur=float(prix), km=km, annee=an,
        motorisation=_FUEL.get(fuel, fuel or None),
        co2_gkm=_num(_first(item, "co2Emissions", "co2")),
        masse_kg=_num(_first(item, "weightKg", "weight")),
        pays=Pays.de,
    )


def item_to_eval_input(item: dict, import_costs: dict | None = None,
                       today: date | None = None) -> dict:
    """Construit une entree d'evaluation complete depuis une annonce Apify.
    Auto-remplit carburant, boite, annee, poids, CO2 (si present) et pre-arme
    les flags (HU, accident)."""
    today = today or date.today()
    fuel = str(_first(item, "fuelType", "fuel") or "").lower()
    trans = str(_first(item, "transmission", "gearbox") or "").lower()
    kw = _num(_first(item, "powerKw", "powerKW"))
    hp = _num(_first(item, "powerHp", "powerHP"))

    hu = str(_first(item, "huStatus", "hu") or "").lower()
    tuv_fallig = None
    if hu:
        tuv_fallig = any(w in hu for w in ("fällig", "due", "expired", "abgelaufen"))
        if any(w in hu for w in ("new", "neu", "gültig", "valid")):
            tuv_fallig = False
    has_damage = _first(item, "hasDamage", "isDamageCase")
    unfallfrei = (not has_damage) if isinstance(has_damage, bool) else None

    return {
        "identity": {
            "marque": _first(item, "make") or "",
            "modele": str(_first(item, "model") or ""),
            "annee": _year(_first(item, "firstRegistration",
                                  "firstRegistrationDate")) or today.year,
            "carburant": _CARB.get(fuel, "essence"),
            "motorisation": f"{kw} kW ({hp} ch)" if kw and hp else "",
            "boite": _BOITE.get(trans, "manuelle"),
            "pays_origine": "de",
        },
        "listing": {
            "source": "mobile_de", "url": _first(item, "url", "link"),
            "prix_vendeur_eur": float(_num(_first(item, "price", "priceEur")) or 0),
            "km": _num(_first(item, "mileageKm", "mileage", "km")) or 0,
            "options": [],
            "flags": {"tuv_fallig": tuv_fallig, "unfallfrei": unfallfrei},
        },
        "tco": {
            "co2_gkm": _num(_first(item, "co2Emissions", "co2")),
            "masse_kg": _num(_first(item, "weightKg", "weight")),
            "annees_depuis_1re_immat": _annees_depuis(
                _first(item, "firstRegistrationDate", "firstRegistration"), today),
            "malus_annee": 2026,
            "import_costs": import_costs or {},
        },
    }


def search(criteria: SearchCriteria, max_results: int = 50, **_kw) -> list[Comparable]:
    items = run_actor(criteria, max_results=max_results)
    return [c for it in items if (c := to_comparable(it))]


def build_full_input(criteria: SearchCriteria, target_url: str | None = None,
                     max_results: int = 50, import_costs: dict | None = None,
                     today: date | None = None) -> dict | None:
    """Bout en bout : recupere les annonces, choisit la cible (par URL ou la
    1re), auto-remplit son entree d'evaluation et attache le reste en
    comparables DE."""
    items = run_actor(criteria, max_results=max_results)
    if not items:
        return None
    target = None
    if target_url:
        target = next((it for it in items if (it.get("url") or "") == target_url), None)
    target = target or items[0]
    tid = target.get("listingId")

    data = item_to_eval_input(target, import_costs=import_costs, today=today)
    comps: list[dict] = []
    for it in items:
        if it.get("listingId") == tid:
            continue
        c = to_comparable(it)
        if c:
            comps.append(c.model_dump(mode="json"))
    data["comparables_de"] = comps
    return data
