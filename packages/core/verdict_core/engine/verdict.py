"""Assemblage du verdict : compose valeur exemplaire, cout total pose FR,
marche d'origine et red flags. Ne recalcule rien, orchestre."""
from __future__ import annotations

from ..contracts import ArbitrageImport, RedFlag, Severity, Verdict
from ..market_types import MarketStats
from .tco import TcoResult
from .valuation import ValuationResult


def baseline_checklist(carburant: str, importe: bool) -> list[str]:
    items = [
        "Demarrage a froid : demarrage immediat, ralenti stable, pas de fumee anormale",
        "Essai routier : embrayage, boite, freinage, direction, suspension",
        "A l'arret : niveaux, traces de fuite, pneus, disques et plaquettes",
        "Electronique : ecran, GPS, clim, radars, camera, vitres, verrouillage",
        "Documents : factures d'entretien, carnet, controle technique, historique",
    ]
    if carburant == "diesel":
        items.append("Diesel : FAP et EGR, regeneration, usage anterieur (petits trajets)")
    if importe:
        items += [
            "Import : validite du controle technique (HU), exiger un TUV neuf au contrat",
            "Import : carnet tampon (Scheckheft), mention sans accident (Unfallfrei)",
            "Import : coherence du VIN entre annonce, chassis et documents",
        ]
    return items


def _decision(rentable: bool, has_tco: bool, red_flags: list[RedFlag],
              valeur: float | None, prix_vendeur: float | None) -> str:
    if any(f.severity == Severity.critical for f in red_flags):
        return "Prudence : signaux critiques a lever avant tout engagement"
    if has_tco:
        return "Import interessant" if rentable else "Import non rentable en l'etat"
    if valeur is not None and prix_vendeur is not None:
        return ("Prix correct ou sous la valeur estimee" if prix_vendeur <= valeur
                else "Prix au-dessus de la valeur estimee")
    return "Analyse incomplete"


def build_verdict(
    *,
    valuation: ValuationResult | None = None,
    tco: TcoResult | None = None,
    market_de: MarketStats | None = None,
    prix_vendeur_eur: float | None = None,
    red_flags: list[RedFlag] | None = None,
    checklist: list[str] | None = None,
    carburant: str = "essence",
    importe: bool = True,
) -> Verdict:
    red_flags = red_flags or []
    valeur = valuation.valeur_exemplaire_eur if valuation else None

    arbitrage = None
    rentable = False
    if tco is not None and valeur is not None:
        marge = round(valeur - tco.total_pose_fr_eur, 2)
        rentable = marge > 0
        arbitrage = ArbitrageImport(rentable=rentable, marge_eur=marge)

    # ecart au prix vendeur : en priorite contre le marche d'origine (DE)
    ecart = None
    surcote = 0.0
    if prix_vendeur_eur is not None and market_de is not None:
        ecart = round(prix_vendeur_eur - market_de.median_eur, 2)
        surcote = max(0.0, ecart)
    elif valuation is not None:
        ecart = valuation.ecart_prix_vendeur_eur

    cout_etat = valuation.cout_etat_eur if valuation else 0.0
    levier = round(cout_etat + surcote, 2)

    return Verdict(
        valeur_estimee_exemplaire_eur=valeur,
        ecart_prix_vendeur_eur=ecart,
        arbitrage_import=arbitrage,
        red_flags=red_flags,
        levier_negociation_eur=levier,
        checklist=checklist or baseline_checklist(carburant, importe),
        decision=_decision(rentable, tco is not None, red_flags, valeur, prix_vendeur_eur),
    )
