from verdict_core.adapters.scrapers import apify_mobile
from verdict_core.market_types import SearchCriteria

CRIT = SearchCriteria(marque="BMW", modele="320", annee=2020, km=100000)

CIBLE = {"listingId": "456871337", "make": "BMW", "model": "320",
         "price": 4500, "mileageKm": 260000, "firstRegistration": "03/2008",
         "firstRegistrationDate": "2008-03", "fuelType": "Diesel",
         "transmission": "Manual", "powerKw": 130, "powerHp": 177, "weightKg": 1500}
AUTRE = {"listingId": "999", "make": "BMW", "model": "320",
         "price": 19000, "mileageKm": 90000, "firstRegistration": "01/2021",
         "firstRegistrationDate": "2021-01", "fuelType": "Diesel",
         "transmission": "Automatic", "powerKw": 140, "powerHp": 190, "weightKg": 1600}

URL = "https://suchen.mobile.de/fahrzeuge/details.html?id=456871337&vc=Car"


def test_id_from_url():
    assert apify_mobile._id_from_url(URL) == "456871337"
    assert apify_mobile._id_from_url(
        "https://suchen.mobile.de/auto-inserat/x/460148729.html") == "460148729"
    assert apify_mobile._id_from_url(None) is None


def test_cible_matchee_par_id(monkeypatch):
    monkeypatch.setattr(apify_mobile, "run_actor",
                        lambda crit, max_results=100: [AUTRE, CIBLE])
    monkeypatch.setattr(apify_mobile, "run_urls",
                        lambda urls, max_results=5: [])
    data = apify_mobile.build_full_input(CRIT, target_url=URL)
    assert data["listing"]["prix_vendeur_eur"] == 4500.0   # pas 19000
    assert data["identity"]["annee"] == 2008
    prix = [c["prix_eur"] for c in data["comparables_de"]]
    assert 4500.0 not in prix and 19000.0 in prix


def test_cible_absente_va_la_chercher(monkeypatch):
    monkeypatch.setattr(apify_mobile, "run_actor",
                        lambda crit, max_results=100: [AUTRE])
    monkeypatch.setattr(apify_mobile, "run_urls",
                        lambda urls, max_results=5: [CIBLE])
    data = apify_mobile.build_full_input(CRIT, target_url=URL)
    assert data["listing"]["prix_vendeur_eur"] == 4500.0
