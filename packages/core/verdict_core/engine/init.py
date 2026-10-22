"""Orchestrateur. Assemble une Evaluation a partir des entrees.
P0 : cablage des briques disponibles. TCO et cotes arrivent ensuite."""
from __future__ import annotations

from ..contracts import (
    ArbitrageImport,
    ConditionAssessment,
    Evaluation,
    ListingInput,
    MarketQuote,
    ReliabilityProfile,
    TcoImport,
    VehicleIdentity,
    Verdict,
)
from .redflags import detect_red_flags


def build_evaluation(
    identity: VehicleIdentity,
    listing: ListingInput,
    condition: ConditionAssessment | None = None,
    reliability: ReliabilityProfile | None = None,
    quotes: MarketQuote | None = None,
    tco: TcoImport | None = None,
) -> Evaluation:
    red_flags = detect_red_flags(listing, quotes)

    arbitrage = None
    valeur = None
    if tco and quotes and quotes.marche_fr_eur is not None:
        marge = quotes.marche_fr_eur - tco.total_pose_fr_eur()
        arbitrage = ArbitrageImport(rentable=marge > 0, marge_eur=round(marge, 2))
        valeur = round(tco.total_pose_fr_eur(), 2)

    levier = condition.cout_remise_en_etat_eur() if condition else 0.0

    decision = "incomplet (P0 en cours)"
    if arbitrage is not None:
        decision = "import rentable" if arbitrage.rentable else "import non rentable"

    verdict = Verdict(
        valeur_estimee_exemplaire_eur=valeur,
        arbitrage_import=arbitrage,
        red_flags=red_flags,
        levier_negociation_eur=round(levier, 2),
        decision=decision,
    )

    return Evaluation(
        identity=identity,
        listing=listing,
        condition=condition,
        reliability=reliability,
        quotes=quotes,
        tco=tco,
        verdict=verdict,
    )
