"""CLI P0 : lit une evaluation JSON, imprime le verdict."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from .contracts import ListingInput, VehicleIdentity
from .engine import build_evaluation


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: verdict <fichier_entree.json>")
        raise SystemExit(1)

    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    identity = VehicleIdentity.model_validate(data["identity"])
    listing = ListingInput.model_validate(data["listing"])

    evaluation = build_evaluation(identity, listing)
    print(evaluation.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
