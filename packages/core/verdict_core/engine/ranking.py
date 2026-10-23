"""Score de bon plan et detection de risques, deterministe.
Recompense : sous le marche, bonne note de prix, faible km pour l'age,
vendeur pro. Penalise et signale : accident, CT a refaire, prix suspect
(trop bas = vice cache / arnaque), vendeur particulier, multi-proprietaires."""
from __future__ import annotations

from datetime import date
from statistics import median

from ..market_types import Candidate

_RATING = {
    "GREAT_PRICE": 15, "VERY_GOOD_PRICE": 12, "GOOD_PRICE": 10,
    "REASONABLE_PRICE": 3, "FAIR_PRICE": 3,
    "INCREASED_PRICE": -5, "HIGH_PRICE": -10, "VERY_HIGH_PRICE": -15,
}


def rank_candidates(cands: list[Candidate]) -> tuple[list[Candidate], float | None]:
    prix = [c.prix_eur for c in cands if c.prix_eur > 0]
    med = round(median(prix), 2) if prix else None
    year_now = date.today().year

    for c in cands:
        risks: list[str] = []
        score = 50.0

        ecart = None
        if med:
            ecart = round((c.prix_eur - med) / med * 100, 1)
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
        if age >= 1:
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
