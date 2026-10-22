"""Types marche, purs (aucune I/O). Partages par le moteur et les scrapers."""
from __future__ import annotations

from pydantic import BaseModel

from .contracts import Pays


class Comparable(BaseModel):
    source: str
    url: str | None = None
    prix_eur: float
    km: int
    annee: int
    motorisation: str | None = None
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
