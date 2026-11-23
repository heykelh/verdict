"""Tests de l'identification IA du moteur, sans appel reseau (post simule)."""
from __future__ import annotations

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from verdict_api import engine_ai
from verdict_api.engine_ai import EngineAIRequest

CLIO = EngineAIRequest(make="Renault", model="Clio", year=2013, fuel="Essence",
                       power_ch=90, title="Renault Clio IV 0.9 TCe 90 Zen")

ANSWER = {
    "moteur": "0.9 TCe 90", "code_moteur": "H4Bt", "carburant": "essence",
    "cylindree_cm3": 898, "puissance_ch": 90, "puissance_kw": 66,
    "distribution": "chaine", "confiance": "certaine",
    "raisonnement": ["Essence -> TCe", "90 ch -> 0.9 TCe"],
    "fiabilite": {"note": "bonne", "resume": "ok", "problemes": []},
    "sources": ["https://www.fiches-auto.fr/x"],
}


def fake_resp(text: str, stop: str = "end_turn") -> dict:
    return {
        "stop_reason": stop,
        "content": [
            {"type": "server_tool_use", "name": "web_search", "input": {"query": "clio 4 tce 90"}},
            {"type": "web_search_tool_result", "content": []},
            {"type": "text", "text": "Voici :",
             "citations": [{"url": "https://www.auto-data.net/fr/clio"}]},
            {"type": "text", "text": text},
        ],
        "usage": {"server_tool_use": {"web_search_requests": 2}},
    }


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setenv("VERDICT_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    engine_ai._mem.clear()
    yield
    engine_ai._mem.clear()


def test_extract_json_tolere_les_balises():
    assert engine_ai.extract_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_cache_key_ignore_le_bruit_mais_pas_la_technique():
    a = engine_ai.cache_key(CLIO)
    b = engine_ai.cache_key(CLIO.model_copy(update={"description": "tres propre"}))
    c = engine_ai.cache_key(CLIO.model_copy(update={"power_ch": 120}))
    assert a == b and a != c


def test_message_contient_kw_calcule_et_hint():
    msg = engine_ai.build_user_message(CLIO.model_copy(update={"hint": "0.9 TCe"}))
    assert "66 kW" in msg and "0.9 TCe" in msg and "2013" in msg


def test_ask_claude_payload_et_sources():
    sent = {}

    def post(payload, key):
        sent.update(payload)
        return fake_resp(json.dumps(ANSWER))

    data = engine_ai.ask_claude(CLIO, post=post)
    tool = sent["tools"][0]
    assert tool["type"] == "web_search_20250305"
    assert "fiches-auto.fr" in tool["allowed_domains"]
    assert data["moteur"] == "0.9 TCe 90"
    assert "https://www.auto-data.net/fr/clio" in data["sources"]
    assert data["_meta"]["recherches"] == 2


def test_pause_turn_relance():
    calls = []

    def post(payload, key):
        calls.append(payload)
        if len(calls) == 1:
            return fake_resp("", stop="pause_turn")
        return fake_resp(json.dumps(ANSWER))

    data = engine_ai.ask_claude(CLIO, post=post)
    assert len(calls) == 2 and data["code_moteur"] == "H4Bt"
    assert calls[1]["messages"][-1]["role"] == "assistant"


def test_route_cache(monkeypatch):
    n = {"calls": 0}

    def fake_ask(req):
        n["calls"] += 1
        return dict(ANSWER)

    monkeypatch.setattr(engine_ai, "ask_claude", fake_ask)
    app = FastAPI()
    app.include_router(engine_ai.router)
    client = TestClient(app)
    body = CLIO.model_dump()
    r1 = client.post("/engine-ai", json=body).json()
    r2 = client.post("/engine-ai", json=body).json()
    assert r1["_cache"] is False and r2["_cache"] is True and n["calls"] == 1


def test_sans_cle_503(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    app = FastAPI()
    app.include_router(engine_ai.router)
    r = TestClient(app).post("/engine-ai", json=CLIO.model_dump())
    assert r.status_code == 503
