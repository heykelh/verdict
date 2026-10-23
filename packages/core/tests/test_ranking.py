from verdict_core.engine.ranking import rank_candidates
from verdict_core.market_types import Candidate


def _c(prix, rating=None, damage=False, hu=True, annee=2019, km=100000):
    return Candidate(source="mobile_de", prix_eur=prix, km=km, annee=annee,
                     price_rating=rating, has_damage=damage, hu_ok=hu)


def test_bonne_affaire_devant_la_chere():
    cands = [_c(20000, "HIGH_PRICE"), _c(16000, "GREAT_PRICE"), _c(18000)]
    ranked, _ = rank_candidates(cands)
    assert ranked[0].prix_eur == 16000


def test_accident_flague_et_relegue():
    cands = [_c(16000, "GOOD_PRICE"), _c(16000, "GOOD_PRICE", damage=True)]
    ranked, _ = rank_candidates(cands)
    assert ranked[-1].has_damage is True
    assert any("accident" in r.lower() for r in ranked[-1].risks)


def test_prix_trop_bas_signale_comme_suspect():
    cands = [_c(20000), _c(20000), _c(20000), _c(9000)]
    ranked, _ = rank_candidates(cands)
    suspect = next(c for c in ranked if c.prix_eur == 9000)
    assert any("arnaque" in r.lower() or "bas" in r.lower() for r in suspect.risks)
