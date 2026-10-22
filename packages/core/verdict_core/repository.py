"""Abstraction du stockage. Le moteur ne connait que le Protocol.
Interne = fichiers. Public = Supabase (meme interface, P2)."""
from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Protocol

from .contracts import Evaluation


class EvaluationRepository(Protocol):
    def save(self, evaluation: Evaluation) -> str: ...
    def get(self, evaluation_id: str) -> Evaluation | None: ...


class FileEvaluationRepository:
    """Impl interne P0 : une evaluation = un fichier JSON."""

    def __init__(self, base_dir: str = "data/evaluations") -> None:
        self.base = Path(base_dir)
        self.base.mkdir(parents=True, exist_ok=True)

    def save(self, evaluation: Evaluation) -> str:
        eid = evaluation.id or str(uuid.uuid4())
        evaluation.id = eid
        path = self.base / f"{eid}.json"
        path.write_text(evaluation.model_dump_json(indent=2), encoding="utf-8")
        return eid

    def get(self, evaluation_id: str) -> Evaluation | None:
        path = self.base / f"{evaluation_id}.json"
        if not path.exists():
            return None
        return Evaluation.model_validate_json(path.read_text(encoding="utf-8"))


# P2 : class SupabaseEvaluationRepository implemente le meme Protocol.
