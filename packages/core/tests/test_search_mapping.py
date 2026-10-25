from verdict_core.adapters.scrapers import search_sources as ss

ITEM = {"title": "BMW 320d", "url": "u", "price": 15000, "mileageKm": 120000,
        "firstRegistration": "05/2019", "fuelType": "Diesel", "powerKw": 140,
        "priceRating": "GOOD_PRICE", "hasDamage": False, "huStatus": "New"}
CHER = {"title": "BMW 320d", "url": "u2", "price": 25000, "mileageKm": 60000,
        "firstRegistration": "01/2022", "fuelType": "Diesel", "powerKw": 140,
        "priceRating": "HIGH_PRICE"}


def test_to_candidate_commun():
    c = ss.to_candidate(ITEM)
    assert c.prix_eur == 15000 and c.km == 120000 and c.annee == 2019
    assert c.carburant == "diesel" and c.price_rating == "GOOD_PRICE"
    assert c.hu_ok is True


def test_search_all_agrege_filtre_et_tague(monkeypatch):
    monkeypatch.setattr(ss, "_post", lambda actor, payload, timeout=300: [ITEM, CHER])
    cands, errors = ss.search_all("BMW", "320", f={"price_max": 20000},
                                  sources=["mobile_de", "autoscout24"])
    assert len(cands) == 2                       # CHER (25000) filtre
    assert {c.source for c in cands} == {"mobile_de", "autoscout24"}
    assert all(c.prix_eur <= 20000 for c in cands)
    assert errors == {}
