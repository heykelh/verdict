"""Valeur de l'exemplaire a partir de la cote marche :
base marche + premiums options - cout de remise en etat + ajustement km."""
from __future__ import annotations

from dataclasses import dataclass, field

from ..contracts import ConditionAssessment
from ..market_types import MarketStats


@dataclass
class ValuationResult:
    valeur_exemplaire_eur: float
    base_marche_eur: float
    premiums_options_eur: float
    cout_etat_eur: float
    ajustement_km_eur: float
    ecart_prix_vendeur_eur: float | None
    lignes: dict = field(default_factory=dict)


def premiums_options(options: list[str], params: dict) -> tuple[float, dict]:
    table = params.get("options_premiums_eur", {})
    detail: dict[str, float] = {}
    total = 0.0
    for opt in options:
        key = opt.strip().lower()
        val = float(table.get(key, 0.0))
        if val:
            detail[key] = val
            total += val
    return round(total, 2), detail


def build_valuation(
    *,
    market: MarketStats,
    km_exemplaire: int,
    km_reference: int,
    options: list[str] | None,
    condition: ConditionAssessment | None,
    valuation_params: dict,
    prix_vendeur_eur: float | None = None,
) -> ValuationResult:
    base = float(market.median_eur)
    prem_total, prem_detail = premiums_options(options or [], valuation_params)
    cout_etat = condition.cout_remise_en_etat_eur() if condition else 0.0

    decote = float(valuation_params.get("decote_km_eur_par_1000km", 0.0))
    ajust_km = -round((km_exemplaire - km_reference) / 1000.0 * decote, 2)

    valeur = round(base + prem_total - cout_etat + ajust_km, 2)
    ecart = round(prix_vendeur_eur - valeur, 2) if prix_vendeur_eur is not None else None

    return ValuationResult(
        valeur_exemplaire_eur=valeur,
        base_marche_eur=round(base, 2),
        premiums_options_eur=prem_total,
        cout_etat_eur=round(cout_etat, 2),
        ajustement_km_eur=ajust_km,
        ecart_prix_vendeur_eur=ecart,
        lignes={
            "base_marche": round(base, 2),
            "premiums_options": prem_detail,
            "cout_remise_en_etat": round(cout_etat, 2),
            "ajustement_km": ajust_km,
        },
    )
