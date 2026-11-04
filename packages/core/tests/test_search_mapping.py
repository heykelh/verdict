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


def test_kleinanzeigen_unbeschaedigt_n_est_pas_accidente():
    for cond in ("Unbeschädigtes Fahrzeug", "Unfallfrei"):
        c = ss.to_candidate({**KLEIN, "condition": cond})
        assert c.has_damage is False, cond


def test_annonce_de_plus_de_30_jours_ecartee_et_entonnoir(monkeypatch):
    from datetime import date, timedelta
    vieille = {**ITEM, "url": "v", "createdAt": (date.today() - timedelta(days=60)).isoformat(), "price": 14000}
    recente = {**ITEM, "url": "r", "posted_date": "Heute, 10:00"}
    monkeypatch.setattr(ss, "_post", lambda actor, payload, timeout=300: [vieille, recente, {"title": "x"}])
    stats: dict = {}
    cands, _ = ss.search_all("BMW", "320", sources=["mobile_de"], stats=stats)
    assert [c.url for c in cands] == ["r"]
    st = stats["mobile_de"]
    assert st["recues"] == 3 and st["retenues"] == 1 and st["illisibles"] == 1


def test_kleinanzeigen_toute_l_allemagne_et_filtres():
    p = ss._payload("kleinanzeigen", "BMW", "X1", {"year_min": 2012, "price_max": 15000}, 20)
    assert p["locationCode"] == "" and p["minYear"] == 2012 and p["maxPrice"] == 15000
    assert p["proxyConfiguration"]["apifyProxyGroups"] == ["RESIDENTIAL"]


def test_lecture_annonce_kleinanzeigen(monkeypatch):
    item = {"url": "k", "title": "VW Touran 1.6 TDI", "price": "10.799 €", "posted_date": "04.11.2026",
            "seller_type": "private", "powerKw": 81,
            "attributes": {"Kilometerstand": "175.000 km", "Erstzulassung": "März 2016",
                           "Kraftstoffart": "Diesel", "Fahrzeugzustand": "Unbeschädigtes Fahrzeug",
                           "HU bis": "Mai 2027"}}
    calls = {}
    def fake(actor, payload, timeout=300):
        calls["actor"] = actor
        return [item, {"title": ""}]
    monkeypatch.setattr(ss, "_post", fake)
    items = ss.fetch_kleinanzeigen_ad("https://www.kleinanzeigen.de/s-anzeige/x/1")
    assert calls["actor"] == "apify~cheerio-scraper" and len(items) == 1
    c = ss.to_candidate(items[0])
    assert (c.prix_eur, c.km, c.annee, c.carburant, c.has_damage, c.hu_ok) == (10799, 175000, 2016, "diesel", False, True)
