from verdict_core.adapters.scrapers import search_sources as ss

ITEM = {"title": "BMW 320d", "url": "u", "price": 15000, "mileageKm": 120000,
        "firstRegistration": "05/2019", "fuelType": "Diesel", "powerKw": 140,
        "priceRating": "GOOD_PRICE", "hasDamage": False, "huStatus": "New"}
CHER = {"title": "BMW 320d", "url": "u2", "price": 25000, "mileageKm": 60000,
        "firstRegistration": "01/2022", "fuelType": "Diesel", "powerKw": 140,
        "priceRating": "HIGH_PRICE"}
KLEIN = {"title": "BMW 320d E90", "url": "u3", "price": 2800, "price_eur": 2800,
         "mileage_km": 335832, "year": 2006, "fuel": "Diesel",
         "image_url": "http://img/x.jpg", "condition": "Beschädigtes Fahrzeug",
         "posted_date": "Heute, 09:50"}


def test_to_candidate_commun():
    c = ss.to_candidate(ITEM)
    assert c.prix_eur == 15000 and c.km == 120000 and c.annee == 2019
    assert c.carburant == "diesel" and c.price_rating == "GOOD_PRICE"
    assert c.hu_ok is True


def test_to_candidate_kleinanzeigen_snake_case():
    c = ss.to_candidate(KLEIN)
    assert c is not None
    assert c.prix_eur == 2800 and c.km == 335832 and c.annee == 2006
    assert c.carburant == "diesel"
    assert c.image == "http://img/x.jpg"
    assert c.has_damage is True            # "Beschaedigtes Fahrzeug"


def test_search_all_agrege_filtre_et_tague(monkeypatch):
    monkeypatch.setattr(ss, "_post", lambda actor, payload, timeout=300: [ITEM, CHER])
    cands, errors = ss.search_all("BMW", "320", f={"price_max": 20000},
                                  sources=["mobile_de", "autoscout24"])
    assert len(cands) == 2
    assert {c.source for c in cands} == {"mobile_de", "autoscout24"}
    assert all(c.prix_eur <= 20000 for c in cands)
    assert errors == {}
