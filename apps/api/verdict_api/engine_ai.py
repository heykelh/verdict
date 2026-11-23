"""Identification IA de la motorisation (lien d'annonce -> moteur exact).

Couche 2 de l'identification moteur. La couche 1 reste deterministe
(apps/web/lib/powertrain.ts : code moteur, mots-cles, regles). Ici, Claude
recherche sur des sites de fiches techniques (allowed_domains) et deduit le
moteur exact : marque + modele + annee + carburant + puissance -> moteur.

Exemple : Clio 4, essence, 90 ch, 2013 -> essence donc TCe (pas dCi), 90 ch
essence -> 0.9 TCe 3 cylindres (H4Bt), 66 kW, distribution par chaine.

Regle du projet : l'IA IDENTIFIE et EXPLIQUE avec sources, elle ne CALCULE pas
la note. Le scoring reste deterministe.

La cle ANTHROPIC_API_KEY est lue cote serveur uniquement (Render).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import threading
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

API_URL = "https://api.anthropic.com/v1/messages"
API_VERSION = "2023-06-01"
DEFAULT_MODEL = "claude-sonnet-5-5"
CACHE_TTL_S = 30 * 24 * 3600  # 30 jours : une fiche moteur ne change pas
MAX_SEARCHES = 5

# Sites de fiches techniques et de fiabilite (pas de forums anonymes).
SPEC_DOMAINS = [
    "auto-data.net",
    "fiches-auto.fr",
    "ultimatespecs.com",
    "largus.fr",
    "caradisiac.com",
    "autoplus.fr",
    "automobile-magazine.fr",
    "fr.wikipedia.org",
    "en.wikipedia.org",
    "de.wikipedia.org",
    "adac.de",
]

SYSTEM_PROMPT = """Tu es un expert motoriste automobile europeen. On te donne les
informations d'une annonce de voiture d'occasion. Ton travail : identifier le
moteur EXACT, avec un raisonnement par elimination, puis resumer sa fiabilite
POUR L'ANNEE du vehicule.

Methode obligatoire :
1. Pars du carburant : il elimine des familles (essence -> pas de dCi/HDi/TDI).
2. Pars de la puissance (ch DIN, et kW = ch x 0,7355) : dans la gamme du modele
   et de la generation, quelles motorisations ont cette puissance ?
3. L'annee fixe la generation du modele ET la generation du moteur (ex. le
   1.2 PureTech EB2 de 2016 n'est pas celui de 2024/2025, qui a change de
   distribution ; un moteur peut avoir ete corrige apres un rappel).
4. Si une seule motorisation correspond, conclus avec une confiance "certaine".
   Si plusieurs restent possibles, liste-les et dis ce qui permettrait de
   trancher (code moteur sur la carte grise, rubrique D.2, type mine...).
5. Verifie avec la recherche web sur les sites de fiches techniques.
   N'invente rien : si tu n'as pas de source, dis-le.

Reponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format :
{
  "moteur": "0.9 TCe 90",
  "code_moteur": "H4Bt (H4B 400)",
  "famille": "Energy TCe 3 cylindres",
  "constructeur_moteur": "Renault-Nissan",
  "carburant": "essence",
  "cylindree_cm3": 898,
  "cylindres": 3,
  "suralimentation": "turbo",
  "puissance_ch": 90,
  "puissance_kw": 66,
  "couple_nm": 135,
  "distribution": "chaine",
  "boite_possible": ["manuelle 5"],
  "norme_euro": "Euro 5",
  "generation_moteur": "1re generation (2012-2019)",
  "raisonnement": ["Essence -> famille TCe, les dCi sont diesel.",
                   "90 ch essence sur Clio 4 -> seul le 0.9 TCe 3 cylindres.",
                   "2013 -> Clio 4 phase 1, moteur H4Bt Euro 5."],
  "alternatives": [],
  "confiance": "certaine",
  "fiabilite": {
    "note": "bonne",
    "resume": "Moteur globalement fiable...",
    "problemes": [
      {"titre": "...", "annees": "2012-2014", "gravite": "moyenne",
       "detail": "...", "source": "https://..."}
    ],
    "points_forts": ["..."],
    "entretien": ["Vidange 0W-30 RN0720 tous les 15 000 km max", "..."]
  },
  "evolution": "Ce qui differencie cette annee des autres versions du meme moteur.",
  "sources": ["https://..."]
}
Valeurs autorisees : confiance = certaine | elevee | probable | incertaine ;
fiabilite.note = tres bonne | bonne | moyenne | mauvaise | inconnue ;
gravite = faible | moyenne | elevee ; distribution = courroie | chaine |
courroie humide | engrenages | inconnue. Mets null pour une valeur inconnue.
Ecris en francais."""


class EngineAIRequest(BaseModel):
    make: str
    model: str
    year: Optional[int] = None
    fuel: Optional[str] = None
    power_ch: Optional[int] = None
    power_kw: Optional[int] = None
    displacement_cm3: Optional[int] = None
    gearbox: Optional[str] = None
    title: Optional[str] = None
    version: Optional[str] = None
    engine_code: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=4000)
    hint: Optional[str] = None  # deduction deterministe (powertrain.ts), si dispo
    force: bool = False         # ignorer le cache


router = APIRouter()

_lock = threading.Lock()
_mem: dict[str, dict] = {}


def _cache_path() -> Path:
    base = os.environ.get("VERDICT_DATA_DIR") or "data"
    p = Path(base) / "cache"
    p.mkdir(parents=True, exist_ok=True)
    return p / "engine_ai.json"


def _norm(s: Any) -> str:
    s = "" if s is None else str(s)
    s = unicodedata.normalize("NFD", s.lower())
    s = re.sub(r"[̀-ͯ]", "", s)
    return re.sub(r"[^a-z0-9.]+", " ", s).strip()


def cache_key(req: EngineAIRequest) -> str:
    """Meme voiture technique -> meme cle (le prix, le km, la ville ne comptent pas)."""
    kw = req.power_kw or (round(req.power_ch * 0.7355) if req.power_ch else None)
    parts = [
        _norm(req.make), _norm(req.model), str(req.year or ""), _norm(req.fuel),
        str(kw or ""), str(req.displacement_cm3 or ""), _norm(req.engine_code),
        _norm(req.version) or _norm(req.title)[:80],
    ]
    return hashlib.sha1("|".join(parts).encode()).hexdigest()[:20]


def _load_disk() -> None:
    if _mem:
        return
    try:
        data = json.loads(_cache_path().read_text(encoding="utf-8"))
        if isinstance(data, dict):
            _mem.update(data)
    except (OSError, ValueError):
        pass


def _save_disk() -> None:
    try:
        _cache_path().write_text(json.dumps(_mem, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass  # Render : disque ephemere, le cache memoire suffit


def cache_get(key: str) -> Optional[dict]:
    with _lock:
        _load_disk()
        hit = _mem.get(key)
        if hit and time.time() - hit.get("_at", 0) < CACHE_TTL_S:
            return hit["data"]
    return None


def cache_put(key: str, data: dict) -> None:
    with _lock:
        _mem[key] = {"_at": time.time(), "data": data}
        _save_disk()


def build_user_message(req: EngineAIRequest) -> str:
    lines = ["Annonce a analyser :"]
    fields = [
        ("Marque", req.make), ("Modele", req.model), ("Annee", req.year),
        ("Carburant", req.fuel), ("Puissance (ch DIN)", req.power_ch),
        ("Puissance (kW)", req.power_kw), ("Cylindree (cm3)", req.displacement_cm3),
        ("Boite", req.gearbox), ("Titre de l'annonce", req.title),
        ("Version / finition", req.version), ("Code moteur indique", req.engine_code),
    ]
    for label, val in fields:
        if val not in (None, ""):
            lines.append(f"- {label} : {val}")
    if req.power_ch and not req.power_kw:
        lines.append(f"- (kW calcule : {round(req.power_ch * 0.7355)} kW)")
    if req.hint:
        lines.append(f"- Pre-deduction par regles (a verifier, peut etre fausse) : {req.hint}")
    if req.description:
        lines.append("Extrait de la description :")
        lines.append(req.description[:2500])
    lines.append("")
    lines.append("Identifie le moteur exact, sa generation pour cette annee, "
                 "et sa fiabilite connue. Reponds en JSON uniquement.")
    return "\n".join(lines)


def _post(payload: dict, api_key: str, timeout: int = 90) -> dict:
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "x-api-key": api_key,
            "anthropic-version": API_VERSION,
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"Anthropic HTTP {e.code}: {body}") from e


def extract_json(text: str) -> dict:
    """Recupere l'objet JSON de la reponse (tolere ```json ... ``` autour)."""
    text = re.sub(r"```(?:json)?", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("pas de JSON dans la reponse")
    return json.loads(text[start:end + 1])


def parse_response(resp: dict) -> tuple[dict, list[str], int]:
    """-> (json moteur, urls citees, nombre de recherches)."""
    texts: list[str] = []
    cited: list[str] = []
    for block in resp.get("content", []):
        if block.get("type") == "text":
            texts.append(block.get("text", ""))
            for c in block.get("citations") or []:
                if c.get("url"):
                    cited.append(c["url"])
    # Le JSON final est dans le dernier bloc texte qui en contient un.
    data: Optional[dict] = None
    for t in reversed(texts):
        try:
            data = extract_json(t)
            break
        except ValueError:
            continue
    if data is None:
        data = extract_json("".join(texts))
    usage = (resp.get("usage") or {}).get("server_tool_use") or {}
    return data, cited, int(usage.get("web_search_requests") or 0)


def ask_claude(req: EngineAIRequest, post: Callable[[dict, str], dict] = _post) -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(503, "ANTHROPIC_API_KEY absente cote serveur")
    model = os.environ.get("ANTHROPIC_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    messages: list[dict] = [{"role": "user", "content": build_user_message(req)}]
    payload = {
        "model": model,
        "max_tokens": 3000,
        "system": SYSTEM_PROMPT,
        "messages": messages,
        "tools": [{
            "type": "web_search_20250305",
            "name": "web_search",
            "max_uses": MAX_SEARCHES,
            "allowed_domains": SPEC_DOMAINS,
            "user_location": {"type": "approximate", "country": "FR",
                              "timezone": "Europe/Paris"},
        }],
    }
    resp = post(payload, api_key)
    # pause_turn : la recherche n'est pas finie, on renvoie le tour tel quel.
    for _ in range(2):
        if resp.get("stop_reason") != "pause_turn":
            break
        messages = messages + [{"role": "assistant", "content": resp["content"]}]
        resp = post({**payload, "messages": messages}, api_key)
    try:
        data, cited, searches = parse_response(resp)
    except (ValueError, json.JSONDecodeError) as e:
        raise HTTPException(502, f"Reponse IA illisible : {e}") from e
    sources = list(dict.fromkeys([*(data.get("sources") or []), *cited]))
    data["sources"] = [u for u in sources if isinstance(u, str) and u.startswith("http")][:8]
    data["_meta"] = {"model": model, "recherches": searches,
                     "genere_le": time.strftime("%Y-%m-%d")}
    return data


@router.post("/engine-ai")
def engine_ai(req: EngineAIRequest) -> dict:
    if not req.make.strip() or not req.model.strip():
        raise HTTPException(422, "marque et modele obligatoires")
    key = cache_key(req)
    if not req.force:
        hit = cache_get(key)
        if hit is not None:
            return {**hit, "_cache": True}
    try:
        data = ask_claude(req)
    except HTTPException:
        raise
    except Exception as e:  # reseau, timeout, quota
        raise HTTPException(502, f"Analyse IA indisponible : {e}") from e
    cache_put(key, data)
    return {**data, "_cache": False}
