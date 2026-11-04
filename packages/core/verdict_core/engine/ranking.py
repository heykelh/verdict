"""Note « bon plan » sur 100, deterministe et identique pour les 3 sites.

Logique d'un chasseur de bonnes affaires professionnel : une voiture fiable, en bon etat
et pas chere. Six criteres, chacun detaille dans `score_details` :

    Prix (40)          ecart au prix de marche estime pour son age et son kilometrage
    Etat (25)          accident, controle technique, nombre de proprietaires
    Usage (15)         kilometrage par an et kilometrage total
    Fraicheur (10)     anciennete de l'annonce (les bonnes affaires partent vite)
    Transparence (5)   informations fournies par l'annonce
    Vendeur (5)        professionnel (garantie legale) ou particulier

La note de prix affichee par le site (« Sehr guter Preis »...) n'entre PAS dans la note :
seuls mobile.de et AutoScout24 la fournissent, elle desavantageait Kleinanzeigen.

Prix du marche estime PAR voiture : regression lineaire prix = b0 + b1*age + b2*km/10000
sur les annonces non accidentees du lot, bornee a 50-180 % de la mediane, repli sur la
mediane quand le lot est trop petit.
"""
from __future__ import annotations

import re
from datetime import date
from statistics import median

from ..market_types import Candidate

WEIGHTS = {"prix": 40, "etat": 25, "usage": 15, "fraicheur": 10, "transparence": 5, "vendeur": 5}

# Plafonds de la note totale pour les annonces a risque grave.
CAP_ACCIDENT = 40
CAP_PRIX_SUSPECT = 35

RISK_SUSPECT = "Prix anormalement bas : risque d'arnaque ou de vice cache"
RISK_ACCIDENT = "Vehicule declare accidente"
RISK_CT = "Controle technique a refaire"
RISK_KM = "Kilometrage eleve pour l'age"
RISK_PARTICULIER = "Vendeur particulier : aucune garantie legale"

_PRO = re.compile(r"dealer|h(ä|ae)ndler|gewerb|commercial|company|pro")
_PRIV = re.compile(r"priv|particulier")


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


def _seller(c: Candidate) -> str:
    s = (c.seller_type or "").lower()
    if _PRO.search(s):
        return "pro"
    if _PRIV.search(s):
        return "particulier"
    return "inconnu"


def _info_count(c: Candidate) -> int:
    fields = [c.puissance_kw, c.hu_ok, c.has_damage, c.previous_owners, c.image, c.carburant]
    return sum(1 for v in fields if v not in (None, ""))


def _dedupe(cands: list[Candidate]) -> list[Candidate]:
    """La meme voiture publiee sur plusieurs sites (meme annee, km et prix) ne compte qu'une fois :
    on garde l'annonce la plus complete."""
    best: dict[tuple, Candidate] = {}
    order: list[tuple] = []
    for c in cands:
        key = (c.annee, c.km, round(c.prix_eur))
        if key not in best:
            best[key] = c
            order.append(key)
        elif _info_count(c) > _info_count(best[key]):
            best[key] = c
    return [best[k] for k in order]


def _pts_prix(ecart: float | None) -> float:
    if ecart is None:
        return 20.0                                  # prix non comparable : neutre (moitie)
    if ecart <= -40:
        return 10.0                                  # trop beau pour etre vrai
    return max(0.0, min(40.0, 22.0 - 0.9 * ecart))   # -20 % = 40 ; 0 % = 22 ; +24 % = 0


def _pts_etat(c: Candidate, risks: list[str]) -> float:
    p = 25.0
    if c.has_damage is True:
        p -= 25
        risks.append(RISK_ACCIDENT)
    elif c.has_damage is None:
        p -= 3
    if c.hu_ok is False:
        p -= 8
        risks.append(RISK_CT)
    elif c.hu_ok is None:
        p -= 3
    o = c.previous_owners
    if o is None:
        p -= 2
    elif o >= 4:
        p -= 8
        risks.append(f"{o} proprietaires successifs")
    elif o == 3:
        p -= 4
    return max(0.0, p)


def _pts_usage(c: Candidate, age: int, risks: list[str]) -> float:
    km_an = c.km / max(age, 1)
    if km_an <= 12000:
        p = 15.0
    elif km_an <= 18000:
        p = 12.0
    elif km_an <= 25000:
        p = 8.0
    elif km_an <= 30000:
        p = 5.0
    else:
        p = 2.0
        risks.append(RISK_KM)
    if c.km > 250000:
        p -= 7
    elif c.km > 200000:
        p -= 4
    return max(0.0, p)


def _pts_fraicheur(c: Candidate, today: date) -> float:
    if not c.date_annonce:
        return 5.0                                   # date inconnue : neutre (moitie)
    try:
        d = date.fromisoformat(c.date_annonce[:10])
    except ValueError:
        return 5.0
    jours = (today - d).days
    if jours <= 3:
        return 10.0
    if jours <= 7:
        return 8.0
    if jours <= 14:
        return 6.0
    if jours <= 30:
        return 3.0
    return 0.0


def _pts_vendeur(c: Candidate, risks: list[str]) -> float:
    s = _seller(c)
    if s == "pro":
        return 5.0
    if s == "particulier":
        risks.append(RISK_PARTICULIER)
    return 3.0


def rank_candidates(cands: list[Candidate]) -> tuple[list[Candidate], float | None]:
    today = date.today()
    year_now = today.year
    cands = _dedupe(cands)

    prix = [c.prix_eur for c in cands if c.prix_eur > 0]
    med = round(median(prix), 2) if prix else None

    # Le marche est estime sur les voitures non accidentees, pour ne pas tirer la cote vers le bas.
    rows = [
        (float(max(0, year_now - c.annee)), float(c.km), float(c.prix_eur))
        for c in cands
        if c.prix_eur > 0 and c.km and c.km > 0 and c.annee and c.has_damage is not True
    ]
    model = _market_model(rows)
    lo = 0.5 * med if med else None
    hi = 1.8 * med if med else None

    for c in cands:
        risks: list[str] = []
        age = max(0, year_now - c.annee)

        # Prix du marche estime pour CETTE voiture (ajuste age + km).
        est: float | None = None
        if model and c.km and c.km > 0 and c.annee:
            b0, b1, b2 = model
            est = b0 + b1 * age + b2 * (c.km / 10000)
            if lo is not None and hi is not None:
                est = max(lo, min(hi, est))
        if (est is None or est <= 0) and len(cands) > 1:
            est = med
        ecart = None
        if est and est > 0:
            c.prix_marche_estime_eur = round(est)
            ecart = round((c.prix_eur - est) / est * 100, 1)
            c.ecart_marche_pct = ecart
        if ecart is not None and ecart <= -40:
            risks.append(RISK_SUSPECT)

        details = {
            "prix": _pts_prix(ecart),
            "etat": _pts_etat(c, risks),
            "usage": _pts_usage(c, age, risks),
            "fraicheur": _pts_fraicheur(c, today),
            "transparence": round(5 * _info_count(c) / 6, 1),
            "vendeur": _pts_vendeur(c, risks),
        }
        total = sum(details.values())
        if c.has_damage is True:
            total = min(total, CAP_ACCIDENT)
        if ecart is not None and ecart <= -40:
            total = min(total, CAP_PRIX_SUSPECT)

        c.risks = risks
        c.score_details = {k: round(v, 1) for k, v in details.items()}
        c.score = round(total, 1)

    ranked = sorted(cands, key=lambda x: x.score, reverse=True)
    return ranked, med
