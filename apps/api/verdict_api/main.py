"""API VERDICT : expose le moteur en HTTP. Ne calcule rien, delegue a verdict_core."""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from verdict_core.adapters.scrapers import apify_mobile
from verdict_core.adapters.scrapers.registry import gather
from verdict_core.cli import run
from verdict_core.market_types import SearchCriteria
from verdict_core.repository import FileEvaluationRepository

from .schemas import (
    ComparablesRequest, ComparablesResponse, EvaluateFromUrlRequest,
    EvaluationRequest, EvaluationResponse,
)

app = FastAPI(title="VERDICT API", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_repo = FileEvaluationRepository()


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


@app.post("/evaluate-from-url", response_model=EvaluationResponse)
def evaluate_from_url(req: EvaluateFromUrlRequest) -> EvaluationResponse:
    crit = SearchCriteria(marque=req.make, modele=req.model, annee=2020, km=0)
    ic = req.import_costs.model_dump() if req.import_costs else None
    data = apify_mobile.build_full_input(crit, target_url=req.url, import_costs=ic)
    if not data:
        raise HTTPException(status_code=404, detail="Annonce introuvable via Apify")
    evaluation, fiche = run(data)
    eid = _repo.save(evaluation)
    return EvaluationResponse(id=eid, evaluation=evaluation, fiche=fiche)


@app.get("/evaluation/{evaluation_id}")
def get_evaluation(evaluation_id: str):
    ev = _repo.get(evaluation_id)
    if ev is None:
        raise HTTPException(status_code=404, detail="Evaluation introuvable")
    return ev
