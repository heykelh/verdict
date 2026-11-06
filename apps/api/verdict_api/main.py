"""API VERDICT : expose le moteur en HTTP. Ne calcule rien, delegue a verdict_core."""
from __future__ import annotations

from collections import Counter
from datetime import date
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from verdict_core.adapters.scrapers import apify_mobile
from verdict_core.adapters.scrapers.registry import gather
from verdict_core.adapters.scrapers.search_sources import (
    _ACTORS, _payload, _post, _posted_date, fetch_kleinanzeigen_ad, search_all, to_candidate,
)
from verdict_core.cli import run
from verdict_core.config import settings
from verdict_core.engine.malus import malus_co2, malus_poids, refaction_occasion
from verdict_core.engine.market_value import estimate_value
from verdict_core.engine.ranking import rank_candidates
from verdict_core.market_types import Candidate, SearchCriteria
from verdict_core.reference import load_malus
from verdict_core.repository import FileEvaluationRepository
from verdict_core.vehicle_names import guess_make_model

from .schemas import (
    CarSearchRequest, ComparablesRequest, ComparablesResponse,
    EvaluateFromUrlRequest, EvaluationRequest, EvaluationResponse,
)

app = FastAPI(title="VERDICT API", version="0.1")

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware, allow_origins=_origins, allow_methods=["*"], allow_headers=["*"],
)

_repo = FileEvaluationRepository()
_IMPORT_FEES_DEFAUT = 1640.0


def _cout_pose(c) -> float:
    """Cout estime une fois pose en France : prix + malus 2026 + frais d'import."""
    malus = load_malus(2026)
    age = max(0, date.today().year - c.annee)
    mco2 = refaction_occasion(malus_co2(c.co2_gkm, malus["co2"]).montant_eur, age, malus["occasion"])
    mpoids = refaction_occasion(malus_poids(c.masse_kg, c.carburant or "", malus["poids"]), age, malus["occasion"])
    return round(c.prix_eur + mco2 + mpoids + _IMPORT_FEES_DEFAUT, 2)


def _source_from_url(url: str) -> str | None:
    h = urlparse(url).netloc.lower()
    if "mobile.de" in h:
        return "mobile_de"
    if "autoscout24" in h:
        return "autoscout24"
    if "kleinanzeigen" in h:
        return "kleinanzeigen"
    return None


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/evaluate", response_model=EvaluationResponse)
def evaluate(req: EvaluationRequest) -> EvaluationResponse:
    evaluation, fiche = run(req.model_dump(mode="json"))
    eid = _repo.save(evaluation)
    return EvaluationResponse(id=eid, evaluation=evaluation, fiche=fiche)


@app.post("/comparables", response_model=ComparablesResponse)
def comparables(req: ComparablesRequest) -> ComparablesResponse:
    crit = SearchCriteria(
        marque=req.marque, modele=req.modele, annee=req.annee, km=req.km,
        annee_tol=req.annee_tol, km_tol=req.km_tol,
    )
    comps = gather(crit, sources=req.sources)
    return ComparablesResponse(count=len(comps), comparables=comps)


@app.post("/search")
def search_cars(req: CarSearchRequest):
    import traceback
    try:
        n = max(1, min(getattr(req, "limit", 10), 50))
        pool = min(60, max(n, 20))
        f = {
            "price_min": getattr(req, "price_min", None), "price_max": req.price_max,
            "year_min": req.year_min, "year_max": getattr(req, "year_max", None),
            "km_min": getattr(req, "km_min", None), "km_max": req.km_max,
            "fuel_types": req.fuel_types, "days_max": getattr(req, "days_max", None),
        }
        stats: dict = {}
        cands, errors = search_all(req.make, req.model, f=f, max_results=pool,
                                   sources=req.sources, stats=stats)
        counts = dict(Counter(c.source for c in cands))
        ranked, _med = rank_candidates(cands)
        # Doublons entre sites (meme voiture) retires par le classement.
        doublons = Counter(c.source for c in cands)
        doublons.subtract(Counter(c.source for c in ranked))
        ranked = ranked[:n]
        top = Counter(c.source for c in ranked)
        for s, st in stats.items():
            st["doublons"] = max(0, doublons.get(s, 0))
            st["dans_le_top"] = top.get(s, 0)
        for c in ranked:
            c.cout_pose_estime_eur = _cout_pose(c)
        return {"count": len(ranked), "candidates": [c.model_dump() for c in ranked],
                "errors": errors, "counts": counts, "funnel": stats}
    except Exception as e:
        return {"count": 0, "candidates": [], "counts": {}, "funnel": {},
                "errors": {"erreur": str(e), "trace": traceback.format_exc()[-900:]}}


@app.post("/evaluate-url")
def evaluate_url(req: dict):
    """Route A : analyse d'UNE annonce a partir de son lien (modele 'apporte ton annonce')."""
    url = (req.get("url") or "").strip()
    src = _source_from_url(url)
    if not src:
        raise HTTPException(status_code=400, detail="Lien non reconnu (mobile.de, AutoScout24 ou Kleinanzeigen attendu).")
    try:
        if src == "kleinanzeigen":
            # L'acteur de recherche Kleinanzeigen n'accepte pas les liens d'annonce.
            items = fetch_kleinanzeigen_ad(url)
        else:
            payload = {"proxyConfiguration": {"useApifyProxy": True}, "startUrls": [{"url": url}]}
            items = _post(_ACTORS[src], payload)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Recuperation impossible : {e}")
    if not items:
        raise HTTPException(status_code=404, detail="Annonce introuvable ou illisible depuis ce lien (supprimee, vendue ou page bloquee).")
    c = to_candidate(items[0])
    if c is None:
        raise HTTPException(status_code=422, detail="Annonce incomplete (prix, km ou annee manquant).")
    c.source = src
    d = _posted_date(items[0], date.today())
    c.date_annonce = d.isoformat() if d else None
    c.cout_pose_estime_eur = _cout_pose(c)
    rank_candidates([c])                 # risques intrinseques (accident, CT, vendeur...)
    c.prix_marche_estime_eur = None      # estime ensuite par /market-value (appele par le site)
    c.ecart_marche_pct = None
    return {"candidate": c.model_dump()}


# Sites interroges pour les comparables : les deux qui filtrent marque et modele a la source
# (Kleinanzeigen demande un proxy residentiel, plus cher, pour un apport faible ici).
_MARKET_SOURCES = ["autoscout24", "mobile_de"]
_MARKET_PER_SITE = 20


@app.post("/market-value")
def market_value(req: dict):
    """Prix de marche estime d'une voiture a partir d'annonces comparables lues en direct.

    Corps : annee et km obligatoires ; marque et modele, ou a defaut le titre de l'annonce ;
    carburant, puissance_kw, prix_eur et url facultatifs (le prix sert a calculer l'ecart)."""
    try:
        annee = int(req.get("annee") or 0)
        km = int(req.get("km") or 0)
    except (TypeError, ValueError):
        annee, km = 0, 0
    if annee < 1980 or km < 0:
        raise HTTPException(status_code=422, detail="Annee et kilometrage necessaires.")
    make, model = req.get("marque") or req.get("make"), req.get("modele") or req.get("model")
    if not (make and model):
        gm, gmod = guess_make_model(req.get("titre"))
        make, model = make or gm, model or gmod
    if not (make and model):
        raise HTTPException(status_code=422, detail="Marque ou modele non reconnus dans le titre de l'annonce.")

    f = {"year_min": annee - 2, "year_max": annee + 2, "km_max": int(km * 1.6 + 20000)}
    comps, errors = search_all(make, model, f=f, max_results=_MARKET_PER_SITE,
                               sources=_MARKET_SOURCES, max_age_days=None)
    prix = float(req.get("prix_eur") or 0)
    target = Candidate(
        source="cible", url=req.get("url"), titre=req.get("titre"), prix_eur=prix or 1.0,
        km=km, annee=annee, carburant=req.get("carburant"),
        puissance_kw=int(req["puissance_kw"]) if req.get("puissance_kw") else None,
    )
    v = estimate_value(target, comps)
    base = {"marque": make, "modele": model, "lues": len(comps), "errors": errors,
            "criteres": f"{make} {model}, {annee - 2} a {annee + 2}, jusqu'a {f['km_max']:,} km".replace(",", " ")}
    if v is None:
        return {**base, "estimate": None, "n": len({(c.annee, c.km, c.prix_eur) for c in comps}),
                "message": "Pas assez d'annonces comparables en ligne pour estimer un prix fiable."}
    ecart = round((prix - v.estimate) / v.estimate * 100, 1) if prix > 0 else None
    return {
        **base, "estimate": v.estimate, "low": v.low, "high": v.high, "n": v.n,
        "confidence": v.confidence, "method": v.method, "ecart_pct": ecart,
        "comparables": [
            {"titre": c.titre, "url": c.url, "source": c.source, "prix_eur": c.prix_eur,
             "km": c.km, "annee": c.annee, "carburant": c.carburant, "puissance_kw": c.puissance_kw}
            for c in v.comparables
        ],
    }


@app.get("/debug/raw")
def debug_raw(source: str = "kleinanzeigen", make: str = "BMW", model: str = "320"):
    """Diagnostic : renvoie les premiers items bruts d'une source, pour caler le mapping."""
    try:
        items = _post(_ACTORS[source], _payload(source, make, model, {}, 3))
        return {"count": len(items), "first_items": items[:2]}
    except Exception as e:
        return {"error": str(e)}


@app.post("/evaluate-from-url", response_model=EvaluationResponse)
def evaluate_from_url(req: EvaluateFromUrlRequest) -> EvaluationResponse:
    crit = SearchCriteria(marque=req.make, modele=req.model, annee=2020, km=0)
    ic = req.import_costs.model_dump() if req.import_costs else None
    try:
        data = apify_mobile.build_full_input(crit, target_url=req.url, import_costs=ic)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Apify: {e}")
    if not data:
        raise HTTPException(status_code=404, detail="Annonce introuvable via Apify")
    try:
        evaluation, fiche = run(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Moteur: {e}")
    eid = _repo.save(evaluation)
    return EvaluationResponse(id=eid, evaluation=evaluation, fiche=fiche)


@app.get("/evaluation/{evaluation_id}")
def get_evaluation(evaluation_id: str):
    ev = _repo.get(evaluation_id)
    if ev is None:
        raise HTTPException(status_code=404, detail="Evaluation introuvable")
    return ev
