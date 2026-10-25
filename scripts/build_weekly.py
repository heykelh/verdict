"""Choix de la semaine : scanne un panier de modeles populaires sur les 3 sites,
classe par score de bon plan, retient les meilleures opportunites (sans risque
grave). Ecrit apps/web/public/weekly.json, servi statiquement par le front."""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from verdict_core.adapters.scrapers.search_sources import search_all
from verdict_core.engine.malus import malus_co2, malus_poids, refaction_occasion
from verdict_core.engine.ranking import rank_candidates
from verdict_core.reference import load_malus

BASKET = [
    ("Volkswagen", "Golf"),
    ("BMW", "320"),
    ("Audi", "A3"),
    ("Mercedes-Benz", "C 220"),
    ("Peugeot", "3008"),
    ("Renault", "Clio"),
]
PER_SOURCE = 15
TOP = 12
IMPORT_FEES = 1640.0


def main() -> None:
    all_cands = []
    for make, model in BASKET:
        try:
            cands, _errs = search_all(make, model, max_results=PER_SOURCE)
            all_cands.extend(cands)
            print(f"[weekly] {make} {model}: {len(cands)} annonces")
        except Exception as e:
            print(f"[weekly] {make} {model} echoue: {e}")

    ranked, _med = rank_candidates(all_cands)
    bons = [c for c in ranked
            if not any(("arnaque" in r.lower() or "accident" in r.lower()) for r in c.risks)]
    top = bons[:TOP]

    malus = load_malus(2026)
    y = date.today().year
    for c in top:
        age = max(0, y - c.annee)
        mco2 = refaction_occasion(malus_co2(c.co2_gkm, malus["co2"]).montant_eur, age, malus["occasion"])
        mpoids = refaction_occasion(malus_poids(c.masse_kg, c.carburant or "", malus["poids"]), age, malus["occasion"])
        c.cout_pose_estime_eur = round(c.prix_eur + mco2 + mpoids + IMPORT_FEES, 2)

    out = {"generated_at": date.today().isoformat(),
           "picks": [c.model_dump() for c in top]}
    dest = Path("apps/web/public/weekly.json")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[weekly] {len(top)} opportunites ecrites dans {dest}")


if __name__ == "__main__":
    main()
