"""Score de bon plan et detection de risques, deterministe.
Prix du marche estime PAR voiture : regression lineaire (prix ~ age + km) sur
les annonces comparables du lot, avec bornage et repli sur la mediane quand le
lot est trop petit ou degenere. Recompense : sous le marche, bonne note de prix,
faible km pour l'age, vendeur pro. Penalise et signale : accident, CT a refaire,
prix suspect (trop bas = vice cache / arnaque), vendeur particulier, multi-proprietaires."""
from __future__ import annotations

from datetime import date
from statistics import median

from ..market_types import Candidate

_RATING = {
    "GREAT_PRICE": 15, "VERY_GOOD_PRICE": 12, "GOOD_PRICE": 10,
    "REASONABLE_PRICE": 3, "FAIR_PRICE": 3,
    "INCREASED_PRICE": -5, "HIGH_PRICE": -10, "VERY_HIGH_PRICE": -15,
}


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


def _market_model(rows: list[tuple[float, float, float]]):
    """rows = (age_annees, km, prix). Retourne (b0, b1, b2) de
    prix = b0 + b1*age + b2*(km/10000), ou None si lot trop petit / degenere."""
    if len(rows) < 6:
        return None
    ages = [r[0] for r in rows]
    kms = [r[1] / 10000 for r in rows]
    ys = [r[2] for r in rows]
    if len(set(ages)) < 2 or len(set(kms)) < 2:
        return None
    n = float(len(rows))
    Sa, Sk, Sy = sum(ages), sum(kms), sum(ys)
    Saa = sum(a * a for a in ages)
    Skk = sum(k * k for k in kms)
    Sak = sum(a * k for a, k in zip(ages, kms))
    Say = sum(a * y for a, y in zip(ages, ys))
    Sky = sum(k * y for k, y in zip(kms, ys))
    m = [[n, Sa, Sk], [Sa, Saa, Sak], [Sk, Sak, Skk]]
    return _solve3(m, [Sy, Say, Sky])


def rank_candidates(cands: list[Candidate]) -> tuple[list[Candidate], float | None]:
    prix = [c.prix_eur for c in cands if c.prix_eur > 0]
    med = round(median(prix), 2) if prix else None
    year_now = date.today().year

    rows = [
        (float(max(0, year_now - c.annee)), float(c.km), float(c.prix_eur))
        for c in cands
        if c.prix_eur > 0 and c.km and c.km > 0 and c.annee
    ]
    model = _market_model(rows)
    lo = 0.5 * med if med else None
    hi = 1.8 * med if med else None

    for c in cands:
        risks: list[str] = []
        score = 50.0

        # Prix du marche estime pour CETTE voiture (ajuste age + km)
        est: float | None = None
        if model and c.km and c.km > 0 and c.annee:
            age = max(0, year_now - c.annee)
            b0, b1, b2 = model
            est = b0 + b1 * age + b2 * (c.km / 10000)
            if lo is not None and hi is not None:
                est = max(lo, min(hi, est))
        if est is None or est <= 0:
            est = med

        ecart = None
        if est and est > 0:
            c.prix_marche_estime_eur = round(est)
            ecart = round((c.prix_eur - est) / est * 100, 1)
            c.ecart_marche_pct = ecart
            score -= ecart * 0.8                       # moins cher = mieux

        score += _RATING.get((c.price_rating or "").upper(), 0)

        if ecart is not None and ecart <= -40:         # trop beau pour etre vrai
            risks.append("Prix anormalement bas : risque d'arnaque ou de vice cache")
            score -= 60
        if c.has_damage:
            risks.append("Vehicule declare accidente")
            score -= 30
        if c.hu_ok is False:
            risks.append("Controle technique a refaire")
            score -= 10
        if (c.seller_type or "").lower() in ("private", "privat", "particulier"):
            risks.append("Vendeur particulier : aucune garantie legale")
            score -= 4
        if c.previous_owners and c.previous_owners >= 4:
            risks.append(f"{c.previous_owners} proprietaires successifs")
            score -= 6

        age = max(0, year_now - c.annee)
        if age >= 1 and c.km:
            km_par_an = c.km / age
            if km_par_an > 30000:
                risks.append("Kilometrage eleve pour l'age")
                score -= 6
            elif km_par_an < 9000 and age >= 3:
                score += 6                             # faible km = bon signe

        c.risks = risks
        c.score = round(score, 1)

    ranked = sorted(cands, key=lambda x: x.score, reverse=True)
    return ranked, med
