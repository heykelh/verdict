"""Scraper AutoScout24 (paneuropeen : FR et DE).
Meme structure que mobile.de, parametres a confirmer au premier run."""
from __future__ import annotations

from urllib.parse import urlencode

from ...contracts import Pays
from ...market_types import Comparable, SearchCriteria
from ._schema import jsonld_blocks, to_comparable
from .fetch import fetch_html

SOURCE = "autoscout24"
BASE = "https://www.autoscout24.fr"


def build_search_url(crit: SearchCriteria, pays: Pays = Pays.de) -> str:
    params = {
        "make": crit.marque, "model": crit.modele,
        "fregfrom": crit.annee - crit.annee_tol,
        "fregto": crit.annee + crit.annee_tol,
        "kmto": crit.km + crit.km_tol,
        "cy": "D" if pays == Pays.de else "F",
        "sort": "price", "desc": "0",
    }
    return f"{BASE}/lst?{urlencode(params)}"


def search(criteria: SearchCriteria, max_results: int = 50,
           pays: Pays = Pays.de, use_cache: bool = True) -> list[Comparable]:
    html = fetch_html(build_search_url(criteria, pays), use_cache=use_cache)
    out: list[Comparable] = []
    for obj in jsonld_blocks(html):
        c = to_comparable(obj, SOURCE, pays)
        if c:
            out.append(c)
        if len(out) >= max_results:
            break
    return out
