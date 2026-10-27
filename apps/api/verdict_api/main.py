"""API VERDICT : expose le moteur en HTTP. Ne calcule rien, delegue a verdict_core."""
from __future__ import annotations

from collections import Counter
from datetime import date
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from verdict_core.adapters.scrapers import apify_mobile
from verdict_core.adapters.scrapers.registry import gather
from verdict_core.adapters.scrapers.search_sources import (
    _ACTORS, _payload, _post, search_all, to_candidate,
)
from verdict_core.cli import run
from verdict_core.config import settings
from verdict_core.engine.malus import malus_co2, malus_poids, refaction_occasion
from verdict_core.engine.ranking import rank_candidates
from verdict_core.market_types import SearchCriteria
from verdict_core.reference import load_malus
from verdict_core.repository import FileEvaluationRepository

from .schemas import (
    CarSearchRequest, ComparablesRequest, ComparablesResponse,
    EvaluateFromUrlRequest, EvaluationRequest, EvaluationResponse,
)

app = FastAPI(title="VERDICT API", version="0.1")

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware, allow_origins=_origins, allow_methods=["*"], allow_headers=["*"],
)

_repo = FileEvaluationRepository()
_IMPORT_FEES_DEFAUT = 1640.0


def _cout_pose(c) -> float:
    """Cout estime une fois pose en France : prix + malus 2026 + frais d'import."""
    malus = load_malus(2026)
    age = max(0, date.today().year - c.annee)
    mco2 = refaction_occasion(malus_co2(c.co2_gkm, malus["co2"]).montant_eur, age, malus["occasion"])
    mpoids = refaction_occasion(malus_poids(c.masse_kg, c.carburant or "", malus["poids"]), age, malus["occasion"])
    return round(c.prix_eur + mco2 + mpoids + _IMPORT_FEES_DEFAUT, 2)


def _source_from_url(url: str) -> str | None:
    h = urlparse(url).netloc.lower()
    if "mobile.de" in h:
        return "mobile_de"
    if "autoscout24" in h:
        return "autoscout24"
    if "kleinanzeigen" in h:
        return "kleinanzeigen"
    return None


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/evaluate", response_model=EvaluationResponse)
def evaluate(req: EvaluationRequest) -> EvaluationResponse:
    evaluation, fiche = run(req.model_dump(mode="json"))
    eid = _repo.save(evaluation)
    return EvaluationResponse(id=eid, evaluation=evaluation, fiche=fiche)


@app.post("/comparables", response_model=ComparablesResponse)
def comparables(req: ComparablesRequest) -> ComparablesResponse:
    crit = SearchCriteria(
        marque=req.marque, modele=req.modele, annee=req.annee, km=req.km,
        annee_tol=req.annee_tol, km_tol=req.km_tol,
    )
    comps = gather(crit, sources=req.sources)
    return ComparablesResponse(count=len(comps), comparables=comps)


@app.post("/search")
def search_cars(req: CarSearchRequest):
    import traceback
    try:
        n = max(1, min(getattr(req, "limit", 10), 50))
        pool = min(60, max(n, 20))
        f = {
            "price_min": getattr(req, "price_min", None), "price_max": req.price_max,
            "year_min": req.year_min, "year_max": getattr(req, "year_max", None),
            "km_min": getattr(req, "km_min", None), "km_max": req.km_max,
            "fuel_types": req.fuel_types, "days_max": getattr(req, "days_max", None),
        }
        cands, errors = search_all(req.make, req.model, f=f, max_results=pool,
                                   sources=req.sources)
        counts = dict(Counter(c.source for c in cands))
        ranked, _med = rank_candidates(cands)
        ranked = ranked[:n]
        for c in ranked:
            c.cout_pose_estime_eur = _cout_pose(c)
        return {"count": len(ranked), "candidates": [c.model_dump() for c in ranked],
                "errors": errors, "counts": counts}
    except Exception as e:
        return {"count": 0, "candidates": [], "counts": {},
                "errors": {"erreur": str(e), "trace": traceback.format_exc()[-900:]}}


@app.post("/evaluate-url")
def evaluate_url(req: dict):
    """Route A : analyse d'UNE annonce a partir de son lien (modele 'apporte ton annonce')."""
    url = (req.get("url") or "").strip()
    src = _source_from_url(url)
    if not src:
        raise HTTPException(status_code=400, detail="Lien non reconnu (mobile.de, AutoScout24 ou Kleinanzeigen attendu).")
    payload = {"proxyConfiguration": {"useApifyProxy": True}, "startUrls": [{"url": url}]}
    try:
        items = _post(_ACTORS[src], payload)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Recuperation impossible : {e}")
    if not items:
        raise HTTPException(status_code=404, detail="Annonce introuvable ou illisible depuis ce lien.")
    c = to_candidate(items[0])
    if c is None:
        raise HTTPException(status_code=422, detail="Annonce incomplete (prix, km ou annee manquant).")
    c.source = src
    c.cout_pose_estime_eur = _cout_pose(c)
    rank_candidates([c])                 # risques intrinseques (accident, CT, vendeur...)
    c.prix_marche_estime_eur = None      # pas de comparaison marche sur une annonce isolee
    c.ecart_marche_pct = None
    return {"candidate": c.model_dump()}


@app.get("/debug/raw")
def debug_raw(source: str = "kleinanzeigen", make: str = "BMW", model: str = "320"):
    """Diagnostic : renvoie les premiers items bruts d'une source, pour caler le mapping."""
    try:
        items = _post(_ACTORS[source], _payload(source, make, model, {}, 3))
        return {"count": len(items), "first_items": items[:2]}
    except Exception as e:
        return {"error": str(e)}


@app.post("/evaluate-from-url", response_model=EvaluationResponse)
def evaluate_from_url(req: EvaluateFromUrlRequest) -> EvaluationResponse:
    crit = SearchCriteria(marque=req.make, modele=req.model, annee=2020, km=0)
    ic = req.import_costs.model_dump() if req.import_costs else None
    try:
        data = apify_mobile.build_full_input(crit, target_url=req.url, import_costs=ic)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Apify: {e}")
    if not data:
        raise HTTPException(status_code=404, detail="Annonce introuvable via Apify")
    try:
        evaluation, fiche = run(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Moteur: {e}")
    eid = _repo.save(evaluation)
    return EvaluationResponse(id=eid, evaluation=evaluation, fiche=fiche)


@app.get("/evaluation/{evaluation_id}")
def get_evaluation(evaluation_id: str):
    ev = _repo.get(evaluation_id)
    if ev is None:
        raise HTTPException(status_code=404, detail="Evaluation introuvable")
    return ev
