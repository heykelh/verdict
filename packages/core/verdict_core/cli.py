"""CLI VERDICT : une evaluation complete de bout en bout.
Usage : verdict <entree.json>"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from statistics import median

from .contracts import (
    ConditionAssessment, Evaluation, ImportCosts, ListingInput, SourceRef,
    VehicleIdentity,
)
from .engine import build_evaluation
from .engine.market import compute_market_quote
from .engine.tco import build_tco
from .engine.valuation import build_valuation
from .market_types import Comparable, SearchCriteria
from .reference import load_malus, load_valuation
from .repository import FileEvaluationRepository


def _market(comps, crit):
    return compute_market_quote(comps, crit, min_count=1) if comps else None


def _km_reference(comps, fallback):
    kms = [c.km for c in comps]
    return int(median(kms)) if kms else fallback


def run(data: dict) -> tuple[Evaluation, str]:
    identity = VehicleIdentity.model_validate(data["identity"])
    listing = ListingInput.model_validate(data["listing"])
    condition = (ConditionAssessment.model_validate(data["condition"])
                 if data.get("condition") else None)

    comps_de = [Comparable.model_validate(c) for c in data.get("comparables_de", [])]
    comps_fr = [Comparable.model_validate(c) for c in data.get("comparables_fr", [])]

    search = data.get("search", {})
    crit = SearchCriteria(
        marque=identity.marque, modele=identity.modele, annee=identity.annee,
        km=listing.km, annee_tol=search.get("annee_tol", 1),
        km_tol=search.get("km_tol", 20000),
    )
    market_de = _market(comps_de, crit)
    market_fr = _market(comps_fr, crit)

    # la valeur de revente FR est la base d'arbitrage ; a defaut, DE
    base_market = market_fr or market_de
    comps_base = comps_fr if market_fr else comps_de

    valuation = None
    if base_market is not None:
        valuation = build_valuation(
            market=base_market, km_exemplaire=listing.km,
            km_reference=_km_reference(comps_base, listing.km),
            options=listing.options, condition=condition,
            valuation_params=load_valuation(),
            prix_vendeur_eur=listing.prix_vendeur_eur,
        )

    tco = None
    t = data.get("tco")
    if t is not None:
        tco = build_tco(
            prix_de_eur=listing.prix_vendeur_eur,
            co2_gkm=t.get("co2_gkm"), masse_kg=t.get("masse_kg"),
            carburant=identity.carburant.value,
            annees_depuis_1re_immat=t.get("annees_depuis_1re_immat", 0),
            malus_ref=load_malus(t.get("malus_annee", 2026)),
            import_costs=ImportCosts.model_validate(t.get("import_costs", {})),
            remise_en_etat_eur=0.0,  # deja reflete dans la valeur et le levier
        )

    evaluation = build_evaluation(
        identity, listing, condition=condition, valuation=valuation, tco=tco,
        market_fr=market_fr, market_de=market_de,
    )
    evaluation.lineage = _lineage(market_de, market_fr)
    return evaluation, format_fiche(evaluation, valuation, tco, market_de, market_fr)


def _lineage(market_de, market_fr) -> list[SourceRef]:
    refs = [
        SourceRef(source="Bareme malus CIBS", version="2026", confidence=0.8),
        SourceRef(source="Parametres valorisation", version="0.1", confidence=0.5),
    ]
    if market_de:
        refs.append(SourceRef(source=f"Cote marche DE ({market_de.count} annonces)", confidence=0.7))
    if market_fr:
        refs.append(SourceRef(source=f"Cote marche FR ({market_fr.count} annonces)", confidence=0.7))
    return refs


def _eur(x) -> str:
    if x is None:
        return "n/a"
    return f"{x:>11,.0f} EUR".replace(",", " ")


def format_fiche(ev: Evaluation, val, tco, market_de, market_fr) -> str:
    i, v = ev.identity, ev.verdict
    L = [
        "=" * 56,
        f" {i.marque.upper()} {i.modele} {i.motorisation} ({i.annee})",
        f" {ev.listing.km} km  |  {i.carburant.value}  |  origine {i.pays_origine.value}",
        "=" * 56,
        "COTES",
        f"  Cote marche DE   {_eur(market_de.median_eur if market_de else None)}"
        f"   ({market_de.count if market_de else 0} annonces)",
        f"  Cote marche FR   {_eur(market_fr.median_eur if market_fr else None)}"
        f"   ({market_fr.count if market_fr else 0} annonces)",
    ]
    if val:
        L += [
            "",
            "VALEUR DE L'EXEMPLAIRE",
            f"  Base marche      {_eur(val.base_marche_eur)}",
            f"  + options        {_eur(val.premiums_options_eur)}",
            f"  - etat           {_eur(val.cout_etat_eur)}",
            f"  +/- kilometrage  {_eur(val.ajustement_km_eur)}",
            f"  = valeur         {_eur(val.valeur_exemplaire_eur)}",
        ]
    if tco:
        L += [
            "",
            "COUT TOTAL POSE EN FRANCE",
            f"  Prix vendeur     {_eur(tco.lignes['prix_de'])}",
            f"  + malus CO2      {_eur(tco.lignes['malus_co2'])}"
            + ("  (approxime)" if tco.co2_approx else ""),
            f"  + malus poids    {_eur(tco.lignes['malus_poids'])}",
            f"  + frais import   {_eur(tco.lignes['frais_import'])}",
            f"  = total pose FR  {_eur(tco.total_pose_fr_eur)}",
        ]
    L += ["", "VERDICT"]
    if v.arbitrage_import:
        L.append(f"  Marge import     {_eur(v.arbitrage_import.marge_eur)}")
    L += [
        f"  Ecart au prix    {_eur(v.ecart_prix_vendeur_eur)}",
        f"  Levier de nego   {_eur(v.levier_negociation_eur)}",
        f"  Decision         {v.decision}",
    ]
    if v.red_flags:
        L.append("")
        L.append("POINTS DE VIGILANCE")
        for f in v.red_flags:
            L.append(f"  [{f.severity.value}] {f.message}")
    L += ["", "A VERIFIER PENDANT LA VISITE"]
    L += [f"  - {c}" for c in v.checklist[:6]]
    L += ["", "TRACABILITE"]
    L += [f"  - {r.source}"
          + (f" (v{r.version})" if r.version else "")
          + f" [confiance {r.confidence:.0%}]" for r in ev.lineage]
    L.append("=" * 56)
    return "\n".join(L)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: verdict <entree.json>")
        raise SystemExit(1)
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    evaluation, fiche = run(data)
    print(fiche)
    eid = FileEvaluationRepository().save(evaluation)
    print(f"\nEvaluation enregistree : data/evaluations/{eid}.json")


if __name__ == "__main__":
    main()
