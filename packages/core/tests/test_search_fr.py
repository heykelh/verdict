"""Sites francais (Leboncoin, La Centrale, AutoScout24 France) : lecture, filtres, marche."""
from datetime import date, timedelta

from verdict_core.adapters.scrapers import search_sources as ss

RECENT = (date.today() - timedelta(days=2)).isoformat()

LBC = {  # format de l'acteur blackfalcondata/leboncoin-car-scraper
    "listingId": "3221718473", "url": "https://www.leboncoin.fr/ad/voitures/3221718473",
    "title": "Renault Clio IV 0.9 TCe 90 Zen", "price": 7490, "publishedAt": f"{RECENT} 15:53:45",
    "sellerType": "private", "imageUrls": ["https://img.leboncoin.fr/a.jpg"],
    "description": "Distribution par chaine, entretien Renault.",
    "vehicle": {"brand": "Renault", "model": "Clio", "version": "Clio IV 0.9 TCe 90", "mileageKm": 98000,
                "fuel": "Essence", "gearbox": "Manuelle", "year": 2014, "firstRegistrationDate": "08/2014",
                "dinPower": 90},
}
LC = {  # format de l'acteur memo23/lacentrale-scraper, mode carte
    "classifiedId": "87103513329", "url": "https://www.lacentrale.fr/auto-occasion-annonce-87103513329.html",
    "make": "RENAULT", "model": "CLIO", "version": "IV 1.5 DCI 90 BUSINESS EDC EURO6", "year": 2015,
    "mileage": 125000, "price": 9990, "gearbox": "MANUAL", "energy": "DIESEL",
    "goodDealBadge": "VERY_GOOD_DEAL", "customerType": "PRO", "photoUrl": "https://pictures.lacentrale.fr/x.jpg",
    "firstOnlineDate": RECENT,
}


def test_leboncoin_lu_au_format_commun():
    c = ss.to_candidate(ss.normalize("leboncoin", LBC))
    assert c.prix_eur == 7490 and c.km == 98000 and c.annee == 2014
    assert c.carburant == "essence" and c.puissance_kw == 66      # 90 ch DIN
    assert c.marque == "Renault" and c.modele == "Clio"
    assert c.seller_type == "private" and c.image.endswith("a.jpg")
    assert c.description.startswith("Distribution")


def test_la_centrale_lu_au_format_commun():
    c = ss.to_candidate(ss.normalize("lacentrale", LC))
    assert c.prix_eur == 9990 and c.km == 125000 and c.annee == 2015
    assert c.carburant == "diesel" and c.puissance_kw == 66      # « DCI 90 » lu dans la version
    assert c.seller_type == "dealer" and c.price_rating == "VERY_GOOD_PRICE"
    assert c.titre == "RENAULT CLIO IV 1.5 DCI 90 BUSINESS EDC EURO6"


def test_noms_de_modeles_francais():
    assert ss.fr_model("BMW", "320") == "Série 3"
    assert ss.fr_model("Mercedes-Benz", "A 180") == "Classe A"
    assert ss.fr_model("Mercedes-Benz", "GLC") == "GLC"
    assert ss.fr_model("Renault", "Clio") == "Clio"


def test_payloads_francais():
    lbc = ss._payload("leboncoin", "BMW", "320", {"price_max": 20000, "km_max": 150000}, 20)
    assert lbc["model"] == "BMW_Série 3" and lbc["priceMax"] == 20000 and lbc["mileageMax"] == 150000
    lc = ss._payload("lacentrale", "Mercedes-Benz", "A 180", {"fuel_types": ["diesel", "hybride"]}, 20)
    assert lc["make"] == "MERCEDES" and lc["model"] == "CLASSE A"
    assert lc["energies"] == ["DIESEL", "HYBRID", "PLUGIN_HYBRID"]
    as24 = ss._payload("autoscout24_fr", "Renault", "Clio", {}, 20)
    assert as24["countries"] == ["F"]
    assert ss._payload("autoscout24", "BMW", "320", {}, 20)["countries"] == ["D"]


def test_marches_et_recherche_par_defaut(monkeypatch):
    assert ss.market_of("leboncoin") == "fr" and ss.market_of("mobile_de") == "de"
    vus = []

    def fake_post(actor, payload, timeout=300):
        vus.append(actor)
        return []

    monkeypatch.setattr(ss, "_post", fake_post)
    ss.search_all("BMW", "320")                       # sans sites precises : Allemagne
    assert "blackfalcondata~leboncoin-car-scraper" not in vus


def test_recherche_france_filtre_le_modele(monkeypatch):
    autre = {**LBC, "url": "u2", "title": "Renault Captur", "vehicle": {**LBC["vehicle"], "model": "Captur"}}
    monkeypatch.setattr(ss, "_post", lambda actor, payload, timeout=300: [LBC, autre])
    stats: dict = {}
    cands, errors = ss.search_all("Renault", "Clio", sources=["leboncoin"], stats=stats)
    assert [c.url for c in cands] == [LBC["url"]] and errors == {}
    assert cands[0].source == "leboncoin" and cands[0].date_annonce == RECENT
    assert stats["leboncoin"]["hors_criteres"] == 1


def test_lecture_d_une_annonce_francaise(monkeypatch):
    sent = {}

    def fake_post(actor, payload, timeout=300):
        sent.update(actor=actor, payload=payload)
        return [LC]

    monkeypatch.setattr(ss, "_post", fake_post)
    items = ss.fetch_ad("lacentrale", LC["url"])
    assert sent["payload"]["scrapeDetailPages"] is True
    assert ss.to_candidate(items[0]).prix_eur == 9990
