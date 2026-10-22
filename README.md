# VERDICT

Evaluation de vehicules d'occasion : fiabilite du modele, etat de
l'exemplaire, cout total pose en France (import Allemagne), et
verdict d'achat trace. Architecture determinism-first : le moteur
calcule, le LLM redige.

## Etat
- P0 : moteur core + CLI (en cours)

## Architecture
- packages/core : moteur Python pur (contrats + regles), sans I/O
- packages/core/repository.py : abstraction stockage (fichier -> Supabase plus tard)
- apps/web : front Next.js (P1)
- data/reference : donnees de reference gouvernees et versionnees

## Dev (PowerShell)
    py -3.12 -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install -e .\packages\core

## Posture donnees
Ingestion par collage utilisateur, aucun scraping automatise.
Toute donnee de reference est sourcee, datee, versionnee.
