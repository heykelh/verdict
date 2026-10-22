"""Scraper kleinanzeigen.de (petites annonces, vendeurs particuliers, DE).
Site generaliste : le JSON-LD Vehicle n'est pas garanti. Si l'extraction
revient vide, il faut un parseur de cartes dedie (voir note en bas)."""
from __future__ import annotations

from urllib.parse import urlencode

from ...contracts import Pays
from ...market_types import Comparable, SearchCriteria
from ._schema import jsonld_blocks, to_comparable
from .fetch import fetch_html

SOURCE = "kleinanzeigen"
BASE = "https://www.kleinanzeigen.de"


def build_search_url(crit: SearchCriteria) -> str:
    # Categorie Autos = c216. Annee/km pas dans l'URL : filtres appliques
    # en aval par compute_market_quote (bande annee/km).
    query = f"{crit.marque}-{crit.modele}".lower().replace(" ", "-")
    return f"{BASE}/s-autos/{query}/k0c216"


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
