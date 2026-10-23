"""Scraper mobile.de : recuperation HTML puis parsing RSC."""
from __future__ import annotations

from pathlib import Path
from urllib.parse import urlencode

from ...market_types import Comparable, SearchCriteria
from ._mobile_parser import parse_listings
from .fetch import fetch_html

SOURCE = "mobile_de"
BASE = "https://suchen.mobile.de"


def build_search_url(crit: SearchCriteria) -> str:
    # NOTE : URL de secours. mobile.de cherche par le parametre ms
    # (ms=<makeId>;;<modelId>;<variante>, ex BMW=3500), pas par texte libre.
    # Tant que la table marque->id n'est pas faite, passer l'URL reelle
    # via l'argument url de search().
    params = {
        "dam": "false",
        "isSearchRequest": "true",
        "s": "Car", "vc": "Car",
        "fr": f"{crit.annee - crit.annee_tol}:{crit.annee + crit.annee_tol}",
        "ml": f":{crit.km + crit.km_tol}",
        "sb": "p", "od": "up",
        "q": f"{crit.marque} {crit.modele}",
    }
    return f"{BASE}/fahrzeuge/search.html?{urlencode(params)}"


def search(criteria: SearchCriteria, max_results: int = 50,
           use_cache: bool = True, url: str | None = None,
           headless: bool = True) -> list[Comparable]:
    html = fetch_html(url or build_search_url(criteria),
                      use_cache=use_cache, headless=headless)
    return parse_listings(html)[:max_results]


def parse_file(path: str, max_results: int = 50) -> list[Comparable]:
    """Parse un HTML mobile.de deja enregistre (test et fallback hors ligne)."""
    return parse_listings(Path(path).read_text(encoding="utf-8"))[:max_results]
