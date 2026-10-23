"""Formes de requete et de reponse de l'API. Reutilisent les contrats du core."""
from __future__ import annotations

from pydantic import BaseModel, Field

from verdict_core.contracts import (
    ConditionAssessment, Evaluation, ImportCosts, ListingInput, VehicleIdentity,
)
from verdict_core.market_types import Candidate, Comparable


class TcoRequest(BaseModel):
    co2_gkm: int | None = None
    masse_kg: int | None = None
    annees_depuis_1re_immat: float = 0
    malus_annee: int = 2026
    import_costs: ImportCosts = Field(default_factory=ImportCosts)


class SearchRequest(BaseModel):
    annee_tol: int = 1
    km_tol: int = 20000


class EvaluationRequest(BaseModel):
    identity: VehicleIdentity
    listing: ListingInput
    condition: ConditionAssessment | None = None
    tco: TcoRequest | None = None
    comparables_fr: list[Comparable] = Field(default_factory=list)
    comparables_de: list[Comparable] = Field(default_factory=list)
    search: SearchRequest = Field(default_factory=SearchRequest)


class EvaluationResponse(BaseModel):
    id: str | None
    evaluation: Evaluation
    fiche: str


class ComparablesRequest(BaseModel):
    marque: str
    modele: str
    annee: int
    km: int
    annee_tol: int = 1
    km_tol: int = 20000
    sources: list[str] | None = None


class ComparablesResponse(BaseModel):
    count: int
    comparables: list[Comparable]


class EvaluateFromUrlRequest(BaseModel):
    url: str
    make: str
    model: str
    import_costs: ImportCosts | None = None


class CarSearchRequest(BaseModel):
    make: str
    model: str
    price_max: int | None = None
    year_min: int | None = None
    km_max: int | None = None
    fuel_types: list[str] | None = None
    limit: int = 10
    sources: list[str] | None = None
