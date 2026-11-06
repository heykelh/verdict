"""Estimation du prix de marche d'UNE voiture a partir d'annonces comparables.

Methode (celle d'un expert qui fait sa cote a partir du marche, pas d'une table figee) :

1. Comparables : meme modele, non accidentes, sans doublons. On garde le meme carburant
   et une puissance proche (+/- 20 %) quand il en reste assez.
2. Prix aberrants retires (moins d'un tiers ou plus du triple de la mediane).
3. Regression sur le LOGARITHME du prix : ln(prix) = b0 + b1 x age + b2 x km/10 000.
   Le logarithme traduit une decote en pourcentage (une voiture perd environ 8 a 15 % par an),
   plus realiste qu'une decote en euros fixes.
   - pentes bornees : une voiture ne prend pas de valeur en vieillissant ou en roulant ;
   - constante calee sur la MEDIANE des ecarts (robuste aux annonces extremes) ;
   - deuxieme passe sans les annonces trop eloignees du modele (plus de 2,5 ecarts robustes).
4. Fourchette : prix courant pour cette voiture, du quart le moins cher au quart le plus cher
   des annonces equivalentes (ecart robuste des residus).
5. Peu d'annonces (3 a 7) : mediane des comparables, ramenes a l'age et au kilometrage de la
   voiture avec une decote standard (9 %/an, 2 %/10 000 km). Confiance faible.
6. Moins de 3 annonces : pas d'estimation (on n'invente pas de chiffre).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date
from statistics import median

from ..market_types import Candidate

MIN_REGRESSION = 8          # annonces necessaires pour la regression
MIN_VOISINS = 3             # en dessous : pas d'estimation
DECOTE_AN = 0.09            # repli : decote standard par an (en log, ~ -9 %)
DECOTE_10K = 0.02           # repli : decote standard par 10 000 km (~ -2 %)
PUISSANCE_TOL = 0.20        # +/- 20 % de puissance
Z_QUARTILE = 0.674          # quartiles d'une loi normale


@dataclass
class Valuation:
    estimate: float
    low: float
    high: float
    n: int
    confidence: str                      # "elevee", "moyenne", "faible"
    method: str                          # "regression" ou "voisins"
    comparables: list[Candidate] = field(default_factory=list)


def _det3(m: list[list[float]]) -> float:
    return (
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
        - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
        + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    )


def _solve3(m: list[list[float]], v: list[float]) -> list[float] | None:
    det = _det3(m)
    if abs(det) < 1e-9:
        return None
    out: list[float] = []
    for col in range(3):
        mc = [row[:] for row in m]
        for i in range(3):
            mc[i][col] = v[i]
        out.append(_det3(mc) / det)
    return out


def _ols(rows: list[tuple[float, float, float]]) -> list[float] | None:
    """rows = (age, km/10000, y). Moindres carres pour y = b0 + b1*age + b2*km."""
    n = float(len(rows))
    a = [r[0] for r in rows]
    k = [r[1] for r in rows]
    y = [r[2] for r in rows]
    m = [[n, sum(a), sum(k)],
         [sum(a), sum(x * x for x in a), sum(x * z for x, z in zip(a, k))],
         [sum(k), sum(x * z for x, z in zip(a, k)), sum(z * z for z in k)]]
    v = [sum(y), sum(x * z for x, z in zip(a, y)), sum(x * z for x, z in zip(k, y))]
    return _solve3(m, v)


def _mad(xs: list[float]) -> float:
    md = median(xs)
    return 1.4826 * median(abs(x - md) for x in xs)


def _fit(rows: list[tuple[float, float, float]]) -> tuple[float, float, float] | None:
    """Regression robuste : pentes par moindres carres, bornees, constante par la mediane."""
    if len({r[0] for r in rows}) < 2 or len({round(r[1], 1) for r in rows}) < 2:
        return None
    b = _ols(rows)
    if b is None:
        return None
    b1 = min(0.0, max(-0.35, b[1]))      # 0 a -35 % par an
    b2 = min(0.0, max(-0.15, b[2]))      # 0 a -15 % par 10 000 km
    b0 = median(r[2] - b1 * r[0] - b2 * r[1] for r in rows)
    return b0, b1, b2


def _pool(target: Candidate, comps: list[Candidate]) -> list[Candidate]:
    seen: set[tuple] = set()
    pool: list[Candidate] = []
    for c in comps:
        if c is target or (target.url and c.url == target.url):
            continue
        if not (c.prix_eur and c.prix_eur > 0 and c.km and c.km > 0 and c.annee):
            continue
        if c.has_damage is True:
            continue
        key = (c.annee, c.km, round(c.prix_eur))
        if key in seen:
            continue
        seen.add(key)
        pool.append(c)

    if target.carburant:
        same = [c for c in pool if c.carburant == target.carburant]
        if len(same) >= MIN_VOISINS:
            pool = same
    if target.puissance_kw:
        lo, hi = target.puissance_kw * (1 - PUISSANCE_TOL), target.puissance_kw * (1 + PUISSANCE_TOL)
        close = [c for c in pool if c.puissance_kw and lo <= c.puissance_kw <= hi]
        if len(close) >= MIN_VOISINS:
            pool = close

    if len(pool) >= MIN_VOISINS:
        med = median(c.prix_eur for c in pool)
        pool = [c for c in pool if med / 3 <= c.prix_eur <= med * 3]
    return pool


def _nearest(target: Candidate, pool: list[Candidate], year_now: int, n: int = 6) -> list[Candidate]:
    def dist(c: Candidate) -> float:
        return abs(c.annee - target.annee) + abs(c.km - target.km) / 30000
    return sorted(pool, key=dist)[:n]


def _round50(x: float) -> float:
    return float(round(x / 50) * 50)


def estimate_value(target: Candidate, comps: list[Candidate],
                   year_now: int | None = None) -> Valuation | None:
    """Prix de marche estime pour `target` d'apres `comps`, ou None si trop peu d'annonces."""
    year_now = year_now or date.today().year
    pool = _pool(target, comps)
    n = len(pool)
    if n < MIN_VOISINS:
        return None

    age_t = float(max(0, year_now - target.annee))
    km_t = target.km / 10000
    rows = [(float(max(0, year_now - c.annee)), c.km / 10000, math.log(c.prix_eur)) for c in pool]
    nearest = _nearest(target, pool, year_now)

    if n >= MIN_REGRESSION:
        b = _fit(rows)
        if b is not None:
            res = [r[2] - (b[0] + b[1] * r[0] + b[2] * r[1]) for r in rows]
            s = max(_mad(res), 0.05)
            kept = [r for r, e in zip(rows, res) if abs(e) <= 2.5 * s]
            if len(kept) >= MIN_REGRESSION and len(kept) < len(rows):
                b2 = _fit(kept)
                if b2 is not None:
                    b, rows = b2, kept
                    res = [r[2] - (b[0] + b[1] * r[0] + b[2] * r[1]) for r in rows]
            s = max(_mad(res), 0.04)
            est = math.exp(b[0] + b[1] * age_t + b[2] * km_t)
            ages = [r[0] for r in rows]
            kms = [r[1] for r in rows]
            hors_plage = (age_t < min(ages) - 2 or age_t > max(ages) + 2 or km_t > 1.5 * max(kms))
            nn = len(rows)
            if hors_plage:
                conf = "faible"
            elif nn >= 15 and s <= 0.15:
                conf = "elevee"
            else:
                conf = "moyenne"
            return Valuation(
                estimate=_round50(est),
                low=_round50(est * math.exp(-Z_QUARTILE * s)),
                high=_round50(est * math.exp(Z_QUARTILE * s)),
                n=nn, confidence=conf, method="regression", comparables=nearest,
            )

    # Peu d'annonces : comparables ramenes a l'age et au kilometrage de la voiture.
    adj = [r[2] - DECOTE_AN * (age_t - r[0]) - DECOTE_10K * (km_t - r[1]) for r in rows]
    est = math.exp(median(adj))
    s = max(_mad(adj), 0.08)
    return Valuation(
        estimate=_round50(est),
        low=_round50(est * math.exp(-Z_QUARTILE * s)),
        high=_round50(est * math.exp(Z_QUARTILE * s)),
        n=n, confidence="faible", method="voisins", comparables=nearest,
    )
