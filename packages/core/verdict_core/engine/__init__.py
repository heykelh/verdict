"""Orchestrateur : compose une Evaluation complete a partir des briques."""
from __future__ import annotations

from ..contracts import (
    ConditionAssessment,
    Evaluation,
    ListingInput,
    MarketQuote,
    ReliabilityProfile,
    VehicleIdentity,
)
from ..market_types import MarketStats
from .redflags import detect_red_flags
from .tco import TcoResult
from .valuation import ValuationResult
from .verdict import build_verdict


def _quotes(valuation: ValuationResult | None, market_fr: MarketStats | None,
            market_de: MarketStats | None) -> MarketQuote | None:
    if valuation is None and market_fr is None and market_de is None:
        return None
    return MarketQuote(
        theorique_eur=(valuation.base_marche_eur if valuation else None),
        marche_fr_eur=(market_fr.median_eur if market_fr else None),
        marche_de_eur=(market_de.median_eur if market_de else None),
    )


def build_evaluation(
    identity: VehicleIdentity,
    listing: ListingInput,
    *,
    condition: ConditionAssessment | None = None,
    reliability: ReliabilityProfile | None = None,
    valuation: ValuationResult | None = None,
    tco: TcoResult | None = None,
    market_fr: MarketStats | None = None,
    market_de: MarketStats | None = None,
) -> Evaluation:
    quotes = _quotes(valuation, market_fr, market_de)
    red_flags = detect_red_flags(listing, quotes)

    verdict = build_verdict(
        valuation=valuation,
        tco=tco,
        market_de=market_de,
        prix_vendeur_eur=listing.prix_vendeur_eur,
        red_flags=red_flags,
        carburant=identity.carburant.value,
        importe=(identity.pays_origine.value != "fr"),
    )

    return Evaluation(
        identity=identity,
        listing=listing,
        condition=condition,
        reliability=reliability,
        quotes=quotes,
        tco=(tco.tco if tco else None),
        verdict=verdict,
    )
