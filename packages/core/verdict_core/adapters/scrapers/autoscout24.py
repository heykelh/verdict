"""Source AutoScout24 : non branchee pour l'instant.
Le scraping direct ne filtrait pas correctement (catalogue entier renvoye).
A rebrancher via un acteur Apify dedie, comme mobile.de."""
from __future__ import annotations

from ...market_types import Comparable, SearchCriteria

SOURCE = "autoscout24"


def search(criteria: SearchCriteria, max_results: int = 50, **_kw) -> list[Comparable]:
    return []
