"""Chargement des donnees de reference versionnees."""
from __future__ import annotations

import json
from pathlib import Path

from .config import settings


def _load(*parts: str, reference_dir: str | None = None) -> dict:
    base = Path(reference_dir or settings.reference_dir)
    return json.loads(base.joinpath(*parts).read_text(encoding="utf-8"))


def load_malus(annee: int, reference_dir: str | None = None) -> dict:
    return _load("malus", f"{annee}.json", reference_dir=reference_dir)


def load_valuation(reference_dir: str | None = None) -> dict:
    return _load("valuation", "params.json", reference_dir=reference_dir)
