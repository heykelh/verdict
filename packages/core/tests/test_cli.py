import json
from pathlib import Path

from verdict_core.cli import run

REPO_ROOT = Path(__file__).resolve().parents[3]
EX = json.loads((REPO_ROOT / "examples" / "bmw_320d_import.json").read_text(encoding="utf-8"))


def test_evaluation_complete():
    ev, fiche = run(EX)
    assert ev.quotes.marche_fr_eur == 22000.0
    assert ev.quotes.marche_de_eur == 19250.0
    assert ev.verdict.valeur_estimee_exemplaire_eur == 21900.0
    assert ev.verdict.arbitrage_import.rentable is True
    assert ev.verdict.arbitrage_import.marge_eur == 1474.0
    assert ev.verdict.levier_negociation_eur == 1200.0
    assert ev.verdict.decision == "Import interessant"
    assert ev.lineage
    assert "VERDICT" in fiche
