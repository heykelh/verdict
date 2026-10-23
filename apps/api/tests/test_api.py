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
    assert "VERDICT" in body["fiche"]


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
