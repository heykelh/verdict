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


def test_kleinanzeigen_recherche_par_pages_filtrees():
    p = ss._payload("kleinanzeigen", "BMW", "X1", {"year_min": 2012, "price_max": 15000}, 36)
    urls = [u["url"] for u in p["startUrls"]]
    assert len(urls) == 2 and "ez_i:2012" in urls[0] and "preis::15000" in urls[0]
    assert "/seite:2/" in urls[1]
    assert [u["userData"]["max"] for u in p["startUrls"]] == [25, 11]
    assert p["proxyConfiguration"]["apifyProxyGroups"] == ["RESIDENTIAL"]
    assert ss._ACTORS["kleinanzeigen"] == "apify~cheerio-scraper"


def test_kleinanzeigen_pages_de_resultats_ignorees(monkeypatch):
    annonce = {**KLEIN, "title": "BMW X1 sDrive18d", "url": "a", "condition": "Unfallfrei", "year": 2018}
    monkeypatch.setattr(ss, "_post", lambda actor, payload, timeout=300: [{"page": "search", "found": 1}, annonce])
    stats: dict = {}
    cands, _ = ss.search_all("BMW", "X1", sources=["kleinanzeigen"], stats=stats)
    assert [c.url for c in cands] == ["a"] and stats["kleinanzeigen"]["recues"] == 1


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


def test_lien_recherche_kleinanzeigen_avec_filtres():
    u = ss.klein_search_url("BMW", "X1", {"year_min": 2012, "km_max": 150000, "price_min": 5000, "price_max": 20000})
    assert u == ("https://www.kleinanzeigen.de/s-autos/bmw/preis:5000:20000/c216+autos.ez_i:2012%2C"
                 "+autos.km_i:%2C150000+autos.marke_s:bmw+autos.model_s:x1")
    assert ss.klein_search_url("Mercedes-Benz", "C 220", {}).endswith("autos.marke_s:mercedes_benz+autos.model_s:c_klasse")
    p = ss._payload("kleinanzeigen", "BMW", "X1", {}, 20)
    assert p["startUrls"][0]["url"].endswith("autos.model_s:x1")


def test_modele_dans_le_titre():
    assert ss.model_in_title("BMW", "X1", "BMW X1 sDrive18d")
    assert not ss.model_in_title("BMW", "X1", "BMW 320d Touring")
    assert ss.model_in_title("Mercedes-Benz", "C 220", "Mercedes C-Klasse 220 CDI")
    assert not ss.model_in_title("Mercedes-Benz", "C 220", "Mercedes-Benz E 220")


def test_kleinanzeigen_autre_modele_ecarte(monkeypatch):
    bon = {**KLEIN, "title": "BMW X1 sDrive18d", "url": "a", "condition": "Unfallfrei", "year": 2018}
    autre = {**KLEIN, "title": "BMW 320d Touring", "url": "b", "condition": "Unfallfrei", "year": 2018}
    monkeypatch.setattr(ss, "_post", lambda actor, payload, timeout=300: [bon, autre])
    stats: dict = {}
    cands, _ = ss.search_all("BMW", "X1", sources=["kleinanzeigen"], stats=stats)
    assert [c.url for c in cands] == ["a"] and stats["kleinanzeigen"]["hors_criteres"] == 1
