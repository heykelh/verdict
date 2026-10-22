"""Chargement des donnees de reference versionnees."""
from __future__ import annotations

import json
from pathlib import Path

from .config import settings


def load_malus(annee: int, reference_dir: str | None = None) -> dict:
    base = Path(reference_dir or settings.reference_dir)
    path = base / "malus" / f"{annee}.json"
    return json.loads(path.read_text(encoding="utf-8"))
