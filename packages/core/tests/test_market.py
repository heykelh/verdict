from verdict_core.market_types import Comparable, SearchCriteria
from verdict_core.engine.market import compute_market_quote


def _mk(prix, km=100000, annee=2020):
    return Comparable(source="t", prix_eur=prix, km=km, annee=annee)


CRIT = SearchCriteria(marque="bmw", modele="320d", annee=2020, km=100000)


def test_mediane_et_quartiles():
    comps = [_mk(p) for p in (14000, 15000, 15500, 16000, 16500, 17000, 18000)]
    stats = compute_market_quote(comps, CRIT, min_count=5)
    assert stats is not None and stats.count == 7
    assert stats.median_eur == 16000.0


def test_outlier_retire():
    comps = [_mk(p) for p in (15000, 15500, 16000, 16500, 17000)] + [_mk(50000)]
    stats = compute_market_quote(comps, CRIT, min_count=5)
    assert stats is not None and stats.max_eur <= 17000.0


def test_hors_bande_exclu():
    comps = [_mk(16000) for _ in range(5)] + [_mk(9000, annee=2010)]
    stats = compute_market_quote(comps, CRIT, min_count=5)
    assert stats is not None and stats.min_eur >= 16000.0


def test_trop_peu_de_comparables():
    comps = [_mk(16000) for _ in range(3)]
    assert compute_market_quote(comps, CRIT, min_count=5) is None
