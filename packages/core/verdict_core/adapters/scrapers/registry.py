"""Registre des sources de recherche. mobile.de passe par Apify si un token
est configure, sinon par le parseur HTML en repli."""
from __future__ import annotations

from ...config import settings
from ...market_types import Comparable, SearchCriteria
from . import apify_mobile, autoscout24, kleinanzeigen, mobile_de


def _mobile_de(criteria: SearchCriteria, **kw) -> list[Comparable]:
    fn = apify_mobile.search if settings.apify_token else mobile_de.search
    return fn(criteria, **kw)


SCRAPERS = {
    "mobile_de": _mobile_de,
    "autoscout24": autoscout24.search,
    "kleinanzeigen": kleinanzeigen.search,
}


def gather(criteria: SearchCriteria, sources: list[str] | None = None,
           max_results: int = 50, use_cache: bool = True) -> list[Comparable]:
    out: list[Comparable] = []
    for name in (sources or list(SCRAPERS)):
        try:
            out.extend(SCRAPERS[name](criteria, max_results=max_results,
                                      use_cache=use_cache))
        except Exception as e:
            print(f"[scrape] {name} a echoue: {e}")
    return out
