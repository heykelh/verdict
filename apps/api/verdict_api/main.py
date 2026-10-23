"""API VERDICT : expose le moteur en HTTP. Ne calcule rien, delegue a verdict_core."""
from __future__ import annotations

from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from verdict_core.adapters.scrapers import apify_mobile
from verdict_core.adapters.scrapers.registry import gather
from verdict_core.adapters.scrapers.search_sources import search_all
from verdict_core.cli import run
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_repo = FileEvaluationRepository()
_IMPORT_FEES_DEFAUT = 1640.0  # COC + quitus + CT + carte grise + transport (indicatif)


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
        cands, errors = search_all(
            req.make, req.model, price_max=req.price_max, year_min=req.year_min,
            km_max=req.km_max, fuel_types=req.fuel_types,
            max_results=req.max_results, sources=req.sources,
        )
        ranked, _med = rank_candidates(cands)
        malus = load_malus(2026)
        y = date.today().year
        for c in ranked:
            age = max(0, y - c.annee)
            mco2 = refaction_occasion(
                malus_co2(c.co2_gkm, malus["co2"]).montant_eur, age, malus["occasion"])
            mpoids = refaction_occasion(
                malus_poids(c.masse_kg, c.carburant or "", malus["poids"]), age, malus["occasion"])
            c.cout_pose_estime_eur = round(c.prix_eur + mco2 + mpoids + _IMPORT_FEES_DEFAUT, 2)
        return {"count": len(ranked),
                "candidates": [c.model_dump() for c in ranked], "errors": errors}
    except Exception as e:
        return {"count": 0, "candidates": [],
                "errors": {"erreur": str(e), "trace": traceback.format_exc()[-900:]}}


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
