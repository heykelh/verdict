"""Parseur des resultats mobile.de.

mobile.de rend ses annonces en React Server Components (flight data) dans le
HTML : pas de JSON-LD exploitable pour les annonces. Les champs sont ancres sur
des data-testid uniques (un par annonce), ce qui permet un appariement fiable
par index. Determinism-first : si les comptes ne concordent pas, on renvoie une
liste vide plutot qu'une cote fausse."""
from __future__ import annotations

import re

from ...contracts import Pays
from ...market_types import Comparable

SOURCE = "mobile_de"

# "EZ MM/YYYY" • "XXX.XXX km" • "XXX kW (XXX PS)" • "Carburant"
_ATTR_RE = re.compile(
    r'"EZ (\d{2})/(\d{4})"," . ","([\d.]+) km"," . ",'
    r'"(\d+) kW \((\d+) PS\)"," . ","([A-Za-zÉéèÀ/ ]+)"'
)
_PRICE_ANCHOR = 'data-testid":"main-price-label'
_PRICE_RE = re.compile(r'([\d][\d  .]{2,})\s*€')

_FUEL = {"Diesel": "diesel", "Benzin": "essence",
         "Elektro": "electrique", "Hybrid": "hybride"}


def _normalize(html: str) -> str:
    # flight data : guillemets echappes (\") et espaces insecables
    return html.replace('\\"', '"').replace("\xa0", " ")


def parse_listings(html: str) -> list[Comparable]:
    t = _normalize(html)

    attrs = _ATTR_RE.findall(t)
    prices: list[int] = []
    for seg in t.split(_PRICE_ANCHOR)[1:]:
        m = _PRICE_RE.search(seg)
        if m:
            prices.append(int(re.sub(r"[^\d]", "", m.group(1))))

    # garde-fou : sans appariement 1:1 fiable, pas de cote
    if not attrs or len(attrs) != len(prices):
        return []

    out: list[Comparable] = []
    for (_mo, an, km, kw, ps, fuel), prix in zip(attrs, prices):
        carb = _FUEL.get(fuel.strip(), fuel.strip().lower())
        out.append(Comparable(
            source=SOURCE, prix_eur=float(prix),
            km=int(km.replace(".", "")), annee=int(an),
            motorisation=f"{kw} kW ({ps} ch) {carb}", pays=Pays.de,
        ))
    return out
