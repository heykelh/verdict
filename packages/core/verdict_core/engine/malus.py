"""Calcul du malus ecologique francais a l'immatriculation.
Lit les baremes depuis les donnees de reference, ne code aucun chiffre en dur."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class MalusCo2Result:
    montant_eur: float
    approx: bool          # True si le gramme exact n'est pas dans la grille
    seuil_atteint: bool


def malus_co2(co2_gkm: int | None, co2_ref: dict) -> MalusCo2Result:
    if co2_gkm is None:
        return MalusCo2Result(0.0, approx=True, seuil_atteint=False)

    if co2_gkm < co2_ref["seuil_gkm"]:
        return MalusCo2Result(0.0, approx=False, seuil_atteint=False)

    plafond = float(co2_ref["plafond_eur"])
    if co2_gkm >= co2_ref["plafond_des_gkm"]:
        return MalusCo2Result(plafond, approx=False, seuil_atteint=True)

    grille = co2_ref["grille_eur_par_gkm"]
    if str(co2_gkm) in grille:
        return MalusCo2Result(float(grille[str(co2_gkm)]), approx=False, seuil_atteint=True)

    # gramme absent : on prend le palier connu inferieur et on signale l'approximation
    connus = sorted(int(k) for k in grille)
    inferieurs = [g for g in connus if g <= co2_gkm]
    base = float(grille[str(inferieurs[-1])]) if inferieurs else 0.0
    return MalusCo2Result(min(base, plafond), approx=True, seuil_atteint=True)


def malus_poids(masse_kg: int | None, carburant: str, poids_ref: dict) -> float:
    if masse_kg is None:
        return 0.0
    if carburant in poids_ref.get("exonerations", []):
        return 0.0

    masse = float(masse_kg)
    if carburant == "hybride":
        masse = max(0.0, masse - float(poids_ref.get("abattement_hybride_kg", 0)))

    if masse <= float(poids_ref["seuil_kg"]):
        return 0.0

    tranches = sorted(poids_ref["tranches"], key=lambda t: t["a_partir_de_kg"])
    bounds = [float(t["a_partir_de_kg"]) for t in tranches] + [float("inf")]
    total = 0.0
    for i, t in enumerate(tranches):
        lo, hi = bounds[i], bounds[i + 1]
        if masse > lo:
            total += (min(masse, hi) - lo) * float(t["eur_par_kg"])
    return round(total, 2)


def refaction_occasion(montant_eur: float, annees_depuis_1re_immat: float, occ_ref: dict) -> float:
    taux = float(occ_ref.get("refaction_par_an", 0.0))
    taux_max = float(occ_ref.get("refaction_max", 1.0))
    reduction = min(taux * max(0.0, annees_depuis_1re_immat), taux_max)
    return round(montant_eur * (1.0 - reduction), 2)
