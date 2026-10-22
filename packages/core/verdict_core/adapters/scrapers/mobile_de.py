"""Scraper mobile.de. A aligner au premier run reel :
parametres d'URL de recherche et presence du JSON-LD sur la page."""
from __future__ import annotations

from urllib.parse import urlencode

from ...contracts import Pays
from ...market_types import Comparable, SearchCriteria
from ._schema import jsonld_blocks, to_comparable
from .fetch import fetch_html

SOURCE = "mobile_de"
BASE = "https://www.mobile.de"


def build_search_url(crit: SearchCriteria) -> str:
    # NOTE : codes make/model a confirmer (mobile.de utilise des ids numeriques)
    params = {
        "s": "Car",
        "makeModelVariant1.makeId": crit.marque,
        "makeModelVariant1.modelId": crit.modele,
        "minFirstRegistrationDate": crit.annee - crit.annee_tol,
        "maxFirstRegistrationDate": crit.annee + crit.annee_tol,
        "maxMileage": crit.km + crit.km_tol,
    }
    return f"{BASE}/fahrzeuge/search.html?{urlencode(params)}"


def search(criteria: SearchCriteria, max_results: int = 50,
           use_cache: bool = True) -> list[Comparable]:
    html = fetch_html(build_search_url(criteria), use_cache=use_cache)
    out: list[Comparable] = []
    for obj in jsonld_blocks(html):
        c = to_comparable(obj, SOURCE, Pays.de)
        if c:
            out.append(c)
        if len(out) >= max_results:
            break
    return out
