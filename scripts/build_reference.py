"""Construit la base de prix de référence d'AutoVerdict, modèle par modèle.

Pour chaque modèle de la liste, on relève des annonces réelles (mobile.de, AutoScout24),
on retire les prix extrêmes, puis on cale prix = b0 + b1 x âge + b2 x (km / 10 000).
On produit une entrée « tous carburants » et, quand il y a assez d'annonces,
une entrée par carburant (un diesel et un essence n'ont pas la même cote).

Sortie : apps/web/public/prix-reference.json, lu par le site pour noter le prix
d'une annonce seule. Le fichier n'est jamais écrasé par une base vide.
"""
from __future__ import annotations

import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from statistics import median

from verdict_core.adapters.scrapers.search_sources import search_all
from verdict_core.engine.ranking import _market_model

# Modèles les plus importés d'Allemagne. Même écriture que l'outil admin.
MODELS: list[tuple[str, str]] = [
    ("Volkswagen", "Golf"), ("Volkswagen", "Polo"), ("Volkswagen", "Passat"),
    ("Volkswagen", "Tiguan"), ("Volkswagen", "T-Roc"),
    ("Audi", "A3"), ("Audi", "A4"), ("Audi", "A6"), ("Audi", "Q3"), ("Audi", "Q5"),
    ("BMW", "118"), ("BMW", "320"), ("BMW", "520"), ("BMW", "X1"), ("BMW", "X3"),
    ("Mercedes-Benz", "A 180"), ("Mercedes-Benz", "C 220"), ("Mercedes-Benz", "E 220"),
    ("Skoda", "Octavia"), ("Skoda", "Superb"), ("Seat", "Leon"),
    ("Peugeot", "308"), ("Peugeot", "3008"), ("Renault", "Clio"), ("Renault", "Megane"),
    ("Ford", "Focus"), ("Opel", "Astra"), ("Toyota", "Yaris"),
]
PER_SOURCE = 30                      # annonces par site et par modèle
SOURCES = ["mobile_de", "autoscout24"]
MIN_FUEL = 10                        # annonces minimum pour une entrée par carburant

OUT = Path(__file__).resolve().parents[1] / "apps" / "web" / "public" / "prix-reference.json"


def _trim(rows: list[tuple[float, float, float]]) -> list[tuple[float, float, float]]:
    """Retire les 5 % de prix les plus bas et les plus hauts (épaves, annonces fantaisistes)."""
    if len(rows) < 20:
        return rows
    prices = sorted(r[2] for r in rows)
    lo = prices[int(len(prices) * 0.05)]
    hi = prices[int(len(prices) * 0.95) - 1]
    return [r for r in rows if lo <= r[2] <= hi]


def _entry(make: str, model: str, fuel: str | None, rows, year: int) -> dict | None:
    coef = _market_model(rows)
    if not coef:
        return None
    b0, b1, b2 = coef
    return {
        "make": make, "model": model, "fuel": fuel,
        "b0": round(b0, 2), "b1": round(b1, 2), "b2": round(b2, 2),
        "n": len(rows), "median": round(median(r[2] for r in rows)),
        "ref_year": year,
        "year_min": int(year - max(r[0] for r in rows)),
        "year_max": int(year - min(r[0] for r in rows)),
        "km_max": int(max(r[1] for r in rows)),
    }


def main() -> int:
    year = date.today().year
    models: list[dict] = []
    errors: dict[str, str] = {}

    for make, model in MODELS:
        label = f"{make} {model}"
        try:
            cands, errs = search_all(make, model, f={}, max_results=PER_SOURCE, sources=SOURCES)
        except Exception as e:  # une panne sur un modèle ne bloque pas les autres
            errors[label] = str(e)[:300]
            print(f"[ERREUR] {label} : {errors[label]}")
            continue
        if errs:
            errors[label] = "; ".join(f"{k}: {v}"[:200] for k, v in errs.items())

        tagged = [
            ((c.carburant or "").lower() or None, (float(max(0, year - c.annee)), float(c.km), float(c.prix_eur)))
            for c in cands if c.prix_eur and c.prix_eur > 500 and c.km and c.annee
        ]
        rows = _trim([r for _, r in tagged])
        all_entry = _entry(make, model, None, rows, year)
        if not all_entry:
            print(f"[IGNORÉ] {label} : pas assez d'annonces exploitables ({len(rows)})")
            continue
        models.append(all_entry)
        print(f"[OK] {label} : {all_entry['n']} annonces, médiane {all_entry['median']} €")

        for fuel in sorted({f for f, _ in tagged if f}):
            frows = _trim([r for f, r in tagged if f == fuel])
            if len(frows) >= MIN_FUEL:
                e = _entry(make, model, fuel, frows, year)
                if e:
                    models.append(e)
                    print(f"     {fuel} : {e['n']} annonces, médiane {e['median']} €")

    if not models:
        print("Aucun modèle construit : le fichier existant est conservé.")
        for k, v in errors.items():
            print(f"  {k} : {v}")
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "models": models,
        "errors": errors,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Écrit : {OUT} ({len(models)} entrées, {len(errors)} modèles avec erreurs)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
