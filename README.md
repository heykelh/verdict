# VERDICT

Outil d'evaluation de vehicules d'occasion, oriente import Allemagne vers
France. A partir d'une annonce, VERDICT sort une decision chiffree et
tracable : fiabilite du modele, etat de l'exemplaire, cout total pose en
France (malus et frais d'import compris), cote marche, et arbitrage
d'import.

Architecture determinism-first : le moteur calcule tout (scoring, cotes,
malus, red flags) par des regles deterministes. Le LLM ne sert qu'a extraire
et rediger, jamais a calculer.

## Etat actuel

- P0 (moteur + CLI) : termine
- P1 (API + front interne) : termine
- Cote marche DE en direct : operationnelle via Apify (acteur mobile.de)
- 35 tests verts

## Ce qui fonctionne

- Calcul du malus ecologique 2026 (CO2 + poids) avec refaction occasion
- Cout total pose en France (prix + malus + frais d'import + remise en etat)
- Cote marche (mediane, quartiles, retrait des aberrants par IQR)
- Valeur de l'exemplaire (base marche + options - etat + ajustement km)
- Assemblage du verdict (arbitrage import, ecart au prix, levier de nego)
- Detection de red flags deterministe (TUV fallig, prix aberrant, etc.)
- CLI de bout en bout + fiche de tracabilite
- API FastAPI (/evaluate, /comparables, /evaluation/{id}, /health)
- Front Next.js (coller une annonce, verdict + tracabilite)
- Recuperation des annonces mobile.de via Apify (JSON structure, proxys inclus)

## A venir

- Branchement de la source Apify dans le registre + exploitation des champs
  riches (co2Emissions, weightKg, huStatus, hasDamage, previousOwners)
- Base fiabilite "maladies" curee par motorisation
- Rappels constructeur (RappelConso + Safety Gate EU)
- Decodage VIN (NHTSA vPIC) pour pre-remplir l'identite
- Redaction du rapport par LLM (Groq + Gemini fallback, Langfuse)
- Harnais d'eval (golden dataset, precision/rappel sur les red flags)
- P2 : Supabase, multi-utilisateur, ouverture publique

## Architecture

- `packages/core` : moteur Python pur (contrats Pydantic + regles), sans I/O
  - `verdict_core/contracts.py` : source de verite unique des donnees
  - `verdict_core/engine/` : malus, tco, market, valuation, verdict, redflags
  - `verdict_core/adapters/scrapers/` : sources d'annonces (Apify, HTML, registre)
  - `verdict_core/repository.py` : abstraction stockage (fichier -> Supabase plus tard)
- `apps/api` : FastAPI, couche fine au-dessus du moteur
- `apps/web` : front Next.js 15 / TypeScript
- `data/reference` : donnees de reference gouvernees et versionnees (malus, valorisation)

## Sources de donnees

- Annonces mobile.de : acteur Apify `topapi/mobile-de-listings-scraper` (JSON structure)
- Bareme malus 2026 : encode depuis la loi de finances (CIBS), versionne
- Rappels : RappelConso (data.economie.gouv.fr) + Safety Gate EU (a venir)
- Decodage VIN : NHTSA vPIC (a venir)
- Cote et etat : fournis par l'utilisateur ou derives du marche

## Developpement (Windows / PowerShell)

    py -3.12 -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install -e ".\packages\core[dev]"
    pip install -e ".\apps\api[dev]"
    pytest .\packages\core .\apps\api

Lancer l'API et le front (deux terminaux) :

    uvicorn verdict_api.main:app --reload --port 8000
    cd apps\web ; pnpm install ; pnpm dev

## Configuration (.env a la racine, hors Git)

    VERDICT_APIFY_TOKEN=...        # recuperation mobile.de via Apify
    VERDICT_SCRAPER_PROVIDER=...   # optionnel : scraperapi | scrapingbee
    VERDICT_SCRAPER_API_KEY=...

## Posture donnees

Pas de scraping direct maintenu contre les sites (anti-bot). La recuperation
passe par Apify, qui gere les proxys. Toute donnee de reference est sourcee,
datee, versionnee. Le LLM ne calcule jamais.
