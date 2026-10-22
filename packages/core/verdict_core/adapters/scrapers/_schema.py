"""Extraction des annonces depuis le JSON-LD schema.org embarque dans la page.
Plus stable que des selecteurs CSS, qui changent souvent sur ces sites."""
from __future__ import annotations

import json
import re

from ...contracts import Pays
from ...market_types import Comparable

_LD_RE = re.compile(
    r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>', re.DOTALL
)


def jsonld_blocks(html: str) -> list[dict]:
    blocks: list[dict] = []
    for m in _LD_RE.finditer(html):
        try:
            data = json.loads(m.group(1).strip())
        except json.JSONDecodeError:
            continue
        blocks.extend(data if isinstance(data, list) else [data])
    return blocks


def to_comparable(obj: dict, source: str, pays: Pays) -> Comparable | None:
    if obj.get("@type") not in {"Car", "Vehicle", "Product"}:
        return None
    offers = obj.get("offers") or {}
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    price = offers.get("price") or obj.get("price")
    km = (obj.get("mileageFromOdometer") or {}).get("value")
    annee_raw = (obj.get("vehicleModelDate") or obj.get("productionDate")
                 or obj.get("modelDate"))
    if price is None or km is None or annee_raw is None:
        return None
    try:
        return Comparable(
            source=source, url=obj.get("url"), prix_eur=float(price),
            km=int(float(km)), annee=int(str(annee_raw)[:4]), pays=pays,
        )
    except (TypeError, ValueError):
        return None
