import json
from pathlib import Path

from verdict_core.contracts import ConditionAssessment, ConditionItem, ItemStatut
from verdict_core.market_types import MarketStats
from verdict_core.engine.valuation import build_valuation, premiums_options

REPO_ROOT = Path(__file__).resolve().parents[3]
PARAMS = json.loads(
    (REPO_ROOT / "data" / "reference" / "valuation" / "params.json").read_text(encoding="utf-8")
)


def _market(med=16000.0):
    return MarketStats(count=10, median_eur=med, p25_eur=med - 1000,
                       p75_eur=med + 1000, min_eur=med - 2000, max_eur=med + 2000)


def test_premiums_connus_seulement():
    total, detail = premiums_options(["Toit ouvrant", "Cuir", "Inconnue"], PARAMS)
    attendu = (PARAMS["options_premiums_eur"]["toit ouvrant"]
               + PARAMS["options_premiums_eur"]["cuir"])
    assert total == attendu and "inconnue" not in detail


def test_valeur_egale_base_si_rien_a_ajuster():
    res = build_valuation(market=_market(16000), km_exemplaire=100000,
                          km_reference=100000, options=[], condition=None,
                          valuation_params=PARAMS, prix_vendeur_eur=17000)
    assert res.base_marche_eur == 16000.0
    assert res.valeur_exemplaire_eur == 16000.0
    assert res.ecart_prix_vendeur_eur == 1000.0   # vendeur 1000 au-dessus


def test_options_etat_et_surkilometrage():
    cond = ConditionAssessment(technique=[
        ConditionItem(label="embrayage", statut=ItemStatut.a_prevoir, cout_estime_eur=1200)
    ])
    res = build_valuation(market=_market(16000), km_exemplaire=140000,
                          km_reference=100000, options=["Toit ouvrant"],
                          condition=cond, valuation_params=PARAMS)
    decote = PARAMS["decote_km_eur_par_1000km"]
    toit = PARAMS["options_premiums_eur"]["toit ouvrant"]
    attendu = 16000 + toit - 1200 - (40 * decote)   # 40 000 km de plus
    assert res.valeur_exemplaire_eur == round(attendu, 2)
    assert res.ecart_prix_vendeur_eur is None
