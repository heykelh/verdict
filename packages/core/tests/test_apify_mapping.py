from datetime import date

from verdict_core.adapters.scrapers import apify_mobile

ITEM = {
    "listingId": "460148729",
    "url": "https://suchen.mobile.de/auto-inserat/bmw-320/460148729.html",
    "make": "BMW", "model": "320", "makeId": 3500,
    "price": 29899, "priceCurrency": "EUR",
    "mileageKm": 95100, "firstRegistration": "05/2021",
    "firstRegistrationDate": "2021-05", "fuelType": "Diesel",
    "transmission": "Automatic", "powerKw": 140, "powerHp": 190,
    "weightKg": 1695, "co2Emissions": None, "huStatus": "New",
    "hasDamage": False,
}


def test_to_comparable_enrichi():
    c = apify_mobile.to_comparable(ITEM)
    assert c.prix_eur == 29899.0 and c.km == 95100 and c.annee == 2021
    assert c.masse_kg == 1695
    assert c.co2_gkm is None          # co2 absent chez Apify sur cet item


def test_eval_input_auto_rempli():
    data = apify_mobile.item_to_eval_input(ITEM, today=date(2026, 10, 23))
    assert data["identity"]["carburant"] == "diesel"
    assert data["identity"]["boite"] == "automatique"
    assert data["identity"]["annee"] == 2021
    assert data["tco"]["masse_kg"] == 1695
    assert data["tco"]["co2_gkm"] is None
    assert 5.0 <= data["tco"]["annees_depuis_1re_immat"] <= 6.0
    assert data["listing"]["flags"]["tuv_fallig"] is False   # huStatus "New"
    assert data["listing"]["flags"]["unfallfrei"] is True     # hasDamage False
