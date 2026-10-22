"""API VERDICT : expose le moteur en HTTP. Ne calcule rien, delegue a verdict_core."""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from verdict_core.cli import run
from verdict_core.repository import FileEvaluationRepository

from .schemas import EvaluationRequest, EvaluationResponse

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


@app.get("/evaluation/{evaluation_id}")
def get_evaluation(evaluation_id: str):
    ev = _repo.get(evaluation_id)
    if ev is None:
        raise HTTPException(status_code=404, detail="Evaluation introuvable")
    return ev
