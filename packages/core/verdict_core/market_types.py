"""Types marche, purs (aucune I/O). Partages par le moteur et les scrapers."""
from __future__ import annotations

from pydantic import BaseModel, Field

from .contracts import Pays


class Comparable(BaseModel):
    source: str
    url: str | None = None
    prix_eur: float
    km: int
    annee: int
    motorisation: str | None = None
    co2_gkm: int | None = None
    masse_kg: int | None = None
    pays: Pays = Pays.de


class SearchCriteria(BaseModel):
    marque: str
    modele: str
    motorisation: str | None = None
    annee: int
    km: int
    annee_tol: int = 1
    km_tol: int = 20000


class MarketStats(BaseModel):
    count: int
    median_eur: float
    p25_eur: float
    p75_eur: float
    min_eur: float
    max_eur: float


class Candidate(BaseModel):
    """Une annonce candidate avec son score de bon plan et ses risques."""
    source: str
    url: str | None = None
    titre: str | None = None
    prix_eur: float
    km: int
    annee: int
    carburant: str | None = None
    puissance_kw: int | None = None
    price_rating: str | None = None
    has_damage: bool | None = None
    hu_ok: bool | None = None
    seller_type: str | None = None
    previous_owners: int | None = None
    co2_gkm: int | None = None
    masse_kg: int | None = None
    ecart_marche_pct: float | None = None
    cout_pose_estime_eur: float | None = None
    risks: list[str] = Field(default_factory=list)
    score: float = 0.0
