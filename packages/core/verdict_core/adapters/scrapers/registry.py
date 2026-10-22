"""Registre des sources de recherche. Ajouter une source = une ligne ici."""
from __future__ import annotations

from ...market_types import Comparable, SearchCriteria
from . import autoscout24, kleinanzeigen, mobile_de

SCRAPERS = {
    "mobile_de": mobile_de.search,
    "autoscout24": autoscout24.search,
    "kleinanzeigen": kleinanzeigen.search,
}


def gather(criteria: SearchCriteria, sources: list[str] | None = None,
           max_results: int = 50, use_cache: bool = True) -> list[Comparable]:
    """Collecte les comparables sur plusieurs sources. Un site qui tombe
    ne casse pas la collecte des autres."""
    out: list[Comparable] = []
    for name in (sources or list(SCRAPERS)):
        try:
            out.extend(SCRAPERS[name](criteria, max_results=max_results,
                                      use_cache=use_cache))
        except Exception as e:
            print(f"[scrape] {name} a echoue: {e}")
    return out
