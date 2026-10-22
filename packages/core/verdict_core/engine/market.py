"""Cote marche a partir d'annonces comparables : mediane, quartiles,
filtrage par bande annee/km, retrait des prix aberrants (IQR)."""
from __future__ import annotations

from statistics import median, quantiles

from ..market_types import Comparable, MarketStats, SearchCriteria


def _within_band(c: Comparable, crit: SearchCriteria) -> bool:
    return (abs(c.annee - crit.annee) <= crit.annee_tol
            and abs(c.km - crit.km) <= crit.km_tol)


def _trim_outliers(prices: list[float]) -> list[float]:
    if len(prices) < 4:
        return prices
    q = quantiles(prices, n=4)          # q[0]=Q1, q[2]=Q3
    iqr = q[2] - q[0]
    lo, hi = q[0] - 1.5 * iqr, q[2] + 1.5 * iqr
    return [p for p in prices if lo <= p <= hi]


def compute_market_quote(
    comparables: list[Comparable],
    criteria: SearchCriteria,
    min_count: int = 5,
    trim: bool = True,
) -> MarketStats | None:
    prix = sorted(c.prix_eur for c in comparables if _within_band(c, criteria))
    if trim:
        prix = _trim_outliers(prix)
    if len(prix) < min_count:
        return None
    q = quantiles(prix, n=4)
    return MarketStats(
        count=len(prix),
        median_eur=round(median(prix), 2),
        p25_eur=round(q[0], 2),
        p75_eur=round(q[2], 2),
        min_eur=round(min(prix), 2),
        max_eur=round(max(prix), 2),
    )
