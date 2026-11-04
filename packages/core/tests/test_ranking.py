from datetime import date, timedelta

from verdict_core.engine.ranking import WEIGHTS, rank_candidates
from verdict_core.market_types import Candidate


def _c(prix, rating=None, damage=False, hu=True, annee=2019, km=100000,
       seller=None, source="mobile_de", jours=None):
    d = (date.today() - timedelta(days=jours)).isoformat() if jours is not None else None
    return Candidate(source=source, prix_eur=prix, km=km, annee=annee,
                     price_rating=rating, has_damage=damage, hu_ok=hu,
                     seller_type=seller, date_annonce=d)


def test_poids_total_100():
    assert sum(WEIGHTS.values()) == 100


def test_bonne_affaire_devant_la_chere():
    cands = [_c(20000, km=100000), _c(16000, km=101000), _c(18000, km=102000)]
    ranked, _ = rank_candidates(cands)
    assert ranked[0].prix_eur == 16000


def test_note_du_site_ne_compte_plus():
    # Meme voiture, meme prix : la note « GREAT_PRICE » du site ne doit rien changer.
    a = _c(16000, rating="GREAT_PRICE", km=100000)
    b = _c(16000, rating=None, km=100500, source="kleinanzeigen")
    ranked, _ = rank_candidates([a, b, _c(18000, km=99000)])
    sa = next(c for c in ranked if c.source == "mobile_de" and c.prix_eur == 16000).score
    sb = next(c for c in ranked if c.source == "kleinanzeigen").score
    assert abs(sa - sb) < 1


def test_accident_flague_et_plafonne():
    cands = [_c(16000, km=100000), _c(15000, damage=True, km=101000), _c(17000, km=99000)]
    ranked, _ = rank_candidates(cands)
    acc = next(c for c in ranked if c.has_damage)
    assert ranked[-1] is acc
    assert acc.score <= 40
    assert any("accident" in r.lower() for r in acc.risks)


def test_prix_trop_bas_signale_et_plafonne():
    cands = [_c(20000, km=100000), _c(20000, km=101000), _c(20000, km=102000), _c(9000, km=103000)]
    ranked, _ = rank_candidates(cands)
    suspect = next(c for c in ranked if c.prix_eur == 9000)
    assert any("arnaque" in r.lower() for r in suspect.risks)
    assert suspect.score <= 35


def test_detail_de_la_note():
    ranked, _ = rank_candidates([_c(16000, km=100000), _c(18000, km=90000)])
    d = ranked[0].score_details
    assert set(d) == set(WEIGHTS)
    assert abs(sum(d.values()) - ranked[0].score) < 0.5


def test_doublon_entre_sites_retire():
    a = _c(16000, source="mobile_de")
    b = _c(16000, source="autoscout24")
    ranked, _ = rank_candidates([a, b])
    assert len(ranked) == 1


def test_annonce_recente_devant_ancienne():
    ranked, _ = rank_candidates([_c(16000, km=100000, jours=25), _c(16000, km=100100, jours=1)])
    assert ranked[0].km == 100100


def test_particulier_peu_penalise():
    pro = _c(16000, km=100000, seller="dealer")
    priv = _c(16000, km=100100, seller="private")
    ranked, _ = rank_candidates([pro, priv])
    ecart = abs(ranked[0].score - ranked[1].score)
    assert ecart <= 3
