# VERDICT - Chronologie du developpement

## Phase 0 : cadrage et fondations

- Etude du marche : La Centrale, Argus, Autobiz (cote) ; Caradisiac (fiabilite) ;
  Histovec, CarVertical (historique). Constat : trois silos cloisonnes, personne
  ne repond a "dois-je acheter CET exemplaire, a CE prix".
- Positionnement : angle import Allemagne vers France, cout total pose en France,
  architecture determinism-first, cote gouvernee et tracee.
- Scaffold du monorepo : contrats Pydantic, config env-driven, repository
  abstrait (fichier aujourd'hui, Supabase plus tard), moteur de red flags, CLI.

## Phase P0 : le moteur qui calcule

- Module malus : bareme CO2 et poids 2026 dans un JSON de reference versionne,
  refaction occasion 10%/an, plafond et cumul geres. (test_malus)
- Module TCO import : prix + malus + frais d'import + remise en etat = cout total
  pose en France. (test_tco)
- Module cote marche : mediane, quartiles, filtrage par bande annee/km, retrait
  des prix aberrants par IQR. (test_market)
- Scrapers initiaux (mobile.de, AutoScout24, kleinanzeigen) + registre de sources
  pluggable. (test_registry)
- Module valorisation : valeur de l'exemplaire = base marche + premiums options
  - cout d'etat + ajustement kilometrage. (test_valuation)
- Assemblage du verdict : arbitrage import, ecart au prix, levier de negociation,
  checklist, decision. (test_verdict)
- CLI de bout en bout + fiche de tracabilite. Cas de reference BMW 320d importee :
  marche FR 22000, marche DE 19250, cout pose 20426, marge +1474. (test_cli)

## Corrections notables

- Fichiers de packages enregistres en `init.py` au lieu de `__init__.py` :
  renommage, imports de packages repares.
- `datetime.utcnow()` deprecie en 3.12 : passage en timezone-aware.
- `total_pose_fr_eur` rendu serialisable (champ calcule Pydantic) pour l'affichage.

## Phase P1 : API et front interne

- API FastAPI au-dessus du moteur : /evaluate, /comparables, /evaluation/{id},
  /health. (test_api)
- Front Next.js 15 / TypeScript : coller une annonce, verdict chiffre, cotes,
  fiche de tracabilite depliable.
- Endpoint /comparables + bouton de recuperation des annonces DE.

## Phase scraping : la recuperation des annonces

- Playwright direct sur mobile.de : bloque (page "Zugriff verweigert", anti-bot).
- Analyse du HTML reel mobile.de : format React Server Components, pas de JSON-LD
  exploitable. Parseur RSC construit et verifie sur donnees reelles : 24 annonces,
  mediane 22997. Garde-fou determinism-first : pas d'appariement fiable, pas de cote.
- Gestion du mur de consentement + locale DE dans le fetch Playwright : insuffisant,
  mobile.de bloque le navigateur automatise quel que soit le mode.
- ScraperAPI (proxy + rendu JS) : le tier gratuit n'autorise pas les proxys premium
  requis par mobile.de (HTTP 403). Cul-de-sac sur le gratuit.
- Bascule sur Apify, acteur `topapi/mobile-de-listings-scraper` : proxys inclus,
  JSON structure, plan gratuit 5 $/mois. Operationnel : 30 annonces mappees,
  mediane 21820. L'acteur expose aussi co2Emissions, weightKg, huStatus,
  previousOwners, hasDamage, priceRating (a exploiter pour malus et red flags).

## Prochaines etapes

- Brancher la source Apify dans le registre et exploiter ses champs riches.
- Base fiabilite, rappels (RappelConso + Safety Gate), decodage VIN.
- Redaction du rapport par LLM (Groq + Gemini, Langfuse).
- Harnais d'eval, puis P2 (Supabase, multi-utilisateur, public).
