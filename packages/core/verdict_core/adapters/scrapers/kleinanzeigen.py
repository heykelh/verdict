"""Source kleinanzeigen.de : non branchee pour l'instant.
A rebrancher via un acteur dedie si une cote vendeurs particuliers est voulue."""
from __future__ import annotations

from ...market_types import Comparable, SearchCriteria

SOURCE = "kleinanzeigen"


def search(criteria: SearchCriteria, max_results: int = 50, **_kw) -> list[Comparable]:
    return []
