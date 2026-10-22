from verdict_core.contracts import RedFlag, Severity, TcoImport
from verdict_core.engine.tco import TcoResult
from verdict_core.engine.valuation import ValuationResult
from verdict_core.engine.verdict import baseline_checklist, build_verdict
from verdict_core.market_types import MarketStats


def _val(valeur=15000.0, cout_etat=0.0, ecart=None):
    return ValuationResult(
        valeur_exemplaire_eur=valeur, base_marche_eur=valeur,
        premiums_options_eur=0.0, cout_etat_eur=cout_etat,
        ajustement_km_eur=0.0, ecart_prix_vendeur_eur=ecart,
    )


def _tco(total):
    return TcoResult(tco=TcoImport(prix_de_eur=total), total_pose_fr_eur=total,
                     co2_approx=False, plafond_applique=False)


def _market(med):
    return MarketStats(count=10, median_eur=med, p25_eur=med - 1000,
                       p75_eur=med + 1000, min_eur=med - 2000, max_eur=med + 2000)


def test_arbitrage_rentable():
    v = build_verdict(valuation=_val(15000), tco=_tco(13000))
    assert v.arbitrage_import.rentable is True
    assert v.arbitrage_import.marge_eur == 2000.0
    assert v.decision == "Import interessant"


def test_arbitrage_non_rentable():
    v = build_verdict(valuation=_val(15000), tco=_tco(16000))
    assert v.arbitrage_import.rentable is False
    assert v.decision == "Import non rentable en l'etat"


def test_levier_etat_plus_surcote():
    v = build_verdict(valuation=_val(15000, cout_etat=1200),
                      market_de=_market(14000), prix_vendeur_eur=15000)
    assert v.ecart_prix_vendeur_eur == 1000.0
    assert v.levier_negociation_eur == 2200.0   # 1200 etat + 1000 surcote


def test_flag_critique_prioritaire():
    flag = RedFlag(code="X", severity=Severity.critical, message="test")
    v = build_verdict(valuation=_val(15000), tco=_tco(10000), red_flags=[flag])
    assert "Prudence" in v.decision


def test_checklist_import_diesel():
    items = baseline_checklist("diesel", importe=True)
    assert any("HU" in i for i in items)
    assert any("FAP" in i for i in items)
