import json
from pathlib import Path

from fastapi.testclient import TestClient

from verdict_api import main
from verdict_api.main import app
from verdict_core.market_types import Comparable

REPO_ROOT = Path(__file__).resolve().parents[3]
EX = json.loads((REPO_ROOT / "examples" / "bmw_320d_import.json").read_text(encoding="utf-8"))
client = TestClient(app)


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_evaluate_320d():
    r = client.post("/evaluate", json=EX)
    assert r.status_code == 200
    body = r.json()
    v = body["evaluation"]["verdict"]
    assert v["decision"] == "Import interessant"
    assert v["arbitrage_import"]["marge_eur"] == 1474.0
    assert body["evaluation"]["tco"]["total_pose_fr_eur"] == 20426.0


def test_get_evaluation_roundtrip():
    eid = client.post("/evaluate", json=EX).json()["id"]
    r = client.get(f"/evaluation/{eid}")
    assert r.status_code == 200
    assert r.json()["identity"]["modele"] == "320d"


def test_404():
    assert client.get("/evaluation/inexistant").status_code == 404


def test_comparables(monkeypatch):
    fake = [Comparable(source="mobile_de", prix_eur=19000, km=100000, annee=2020)]
    monkeypatch.setattr(main, "gather", lambda crit, sources=None: fake)
    r = client.post("/comparables",
                    json={"marque": "bmw", "modele": "320d", "annee": 2020, "km": 100000})
    assert r.status_code == 200
    assert r.json()["count"] == 1


def test_evaluate_from_url(monkeypatch):
    monkeypatch.setattr(main.apify_mobile, "build_full_input",
                        lambda *a, **k: EX)
    r = client.post("/evaluate-from-url",
                    json={"url": "https://suchen.mobile.de/x", "make": "BMW", "model": "320"})
    assert r.status_code == 200
    assert r.json()["evaluation"]["verdict"]["decision"]


def test_evaluate_from_url_introuvable(monkeypatch):
    monkeypatch.setattr(main.apify_mobile, "build_full_input", lambda *a, **k: None)
    r = client.post("/evaluate-from-url",
                    json={"url": "x", "make": "BMW", "model": "320"})
    assert r.status_code == 404


def test_market_value(monkeypatch):
    from verdict_core.market_types import Candidate

    def fake_search_all(make, model, f=None, max_results=40, sources=None, stats=None, max_age_days=None):
        assert (make, model) == ("BMW", "X1")
        assert f["year_min"] == 2016 and f["year_max"] == 2020
        comps = [Candidate(source="autoscout24", prix_eur=18000 - 900 * (2018 - a) - 300 * i, annee=a,
                           km=60000 + 15000 * i, carburant="diesel", url=f"u{a}{i}")
                 for a in (2016, 2017, 2018, 2019, 2020) for i in range(3)]
        return comps, {}

    monkeypatch.setattr(main, "search_all", fake_search_all)
    r = client.post("/market-value", json={"titre": "BMW X1 sDrive18d", "annee": 2018, "km": 90000,
                                           "carburant": "diesel", "prix_eur": 15000})
    assert r.status_code == 200
    body = r.json()
    assert body["marque"] == "BMW" and body["n"] == 15
    assert 15000 < body["estimate"] < 19000
    assert body["low"] <= body["estimate"] <= body["high"]
    assert body["ecart_pct"] < 0 and len(body["comparables"]) == 6


def test_market_value_modele_inconnu():
    r = client.post("/market-value", json={"titre": "Super Auto", "annee": 2018, "km": 90000})
    assert r.status_code == 422


def test_evaluate_url_leboncoin_sans_import(monkeypatch):
    lbc = {"url": "https://www.leboncoin.fr/ad/voitures/1", "title": "Renault Clio IV TCe 90",
           "price": 7490, "mileageKm": 98000, "firstRegistration": "2014", "fuelType": "Essence",
           "powerKw": 66, "make": "Renault", "model": "Clio", "publishedAt": "2026-11-20 10:00:00"}
    vus = {}

    def fake_fetch(source, url):
        vus["source"] = source
        return [lbc]

    monkeypatch.setattr(main, "fetch_ad", fake_fetch)
    r = client.post("/evaluate-url", json={"url": lbc["url"]})
    assert r.status_code == 200 and vus["source"] == "leboncoin"
    c = r.json()["candidate"]
    assert c["source"] == "leboncoin"
    assert c["cout_pose_estime_eur"] == 7490          # deja en France : ni import ni malus


def test_sources_reconnues_par_lien():
    assert main._source_from_url("https://www.lacentrale.fr/auto-occasion-annonce-1.html") == "lacentrale"
    assert main._source_from_url("https://www.autoscout24.fr/offres/x") == "autoscout24_fr"
    assert main._source_from_url("https://www.autoscout24.de/angebote/x") == "autoscout24"
    assert main._source_from_url("https://example.com/x") is None


def test_market_value_annonce_francaise_compare_en_france(monkeypatch):
    vus = {}

    def fake_search_all(make, model, f=None, max_results=40, sources=None, stats=None, max_age_days=None):
        vus["sources"] = sources
        return [], {}

    monkeypatch.setattr(main, "search_all", fake_search_all)
    r = client.post("/market-value", json={"marque": "Renault", "modele": "Clio", "annee": 2014, "km": 98000,
                                           "url": "https://www.leboncoin.fr/ad/voitures/1"})
    assert r.status_code == 200 and r.json()["marche"] == "fr"
    assert vus["sources"] == ["leboncoin", "lacentrale"]


def test_search_marche_france(monkeypatch):
    vus = {}

    def fake_search_all(make, model, f=None, max_results=40, sources=None, stats=None, max_age_days=None):
        vus["sources"] = sources
        return [], {}

    monkeypatch.setattr(main, "search_all", fake_search_all)
    r = client.post("/search", json={"make": "Renault", "model": "Clio", "market": "fr"})
    assert r.status_code == 200
    assert vus["sources"] == ["leboncoin", "lacentrale", "autoscout24_fr"]
