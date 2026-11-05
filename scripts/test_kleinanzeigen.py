"""Test manuel de la lecture Kleinanzeigen, en local, pour voir exactement ce qui est recupere.

A lancer depuis la racine du repo (le jeton Apify est lu dans .env : VERDICT_APIFY_TOKEN) :

    python scripts/test_kleinanzeigen.py BMW X1 --annee-min 2012 --km-max 150000 --nombre 10
    python scripts/test_kleinanzeigen.py --annonce https://www.kleinanzeigen.de/s-anzeige/...

Le script affiche :
  - le lien de recherche envoye a Apify (a ouvrir dans le navigateur pour comparer) ;
  - chaque annonce recue, ce qu'on en a lu (prix, km, annee, carburant, date, vendeur, etat)
    et si elle est retenue ou ECARTEE (avec la raison) ;
  - le bilan de l'entonnoir ;
  - un fichier JSON avec les donnees brutes completes, pour me l'envoyer si besoin.

Chaque lancement consomme un peu de credit Apify (quelques centimes).
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from verdict_core.adapters.scrapers import search_sources as ss

OUT_DIR = Path("data") / "debug"


def _ligne(c) -> str:
    return (f"{c.prix_eur:>9,.0f} EUR | {c.km:>7,} km | {c.annee} | {c.carburant or '?':<9} | "
            f"{c.puissance_kw or '?':>4} kW | vendeur {c.seller_type or '?':<8} | "
            f"accident {c.has_damage} | CT ok {c.hu_ok}").replace(",", " ")


def test_recherche(a) -> int:
    f = {"price_min": a.prix_min, "price_max": a.prix_max, "year_min": a.annee_min,
         "year_max": a.annee_max, "km_min": a.km_min, "km_max": a.km_max}
    f = {k: v for k, v in f.items() if v}
    payload = ss._payload("kleinanzeigen", a.marque, a.modele, f, a.nombre)
    print("\nPage(s) de resultats ouvertes (copiez un lien dans le navigateur pour comparer) :")
    for u in payload["startUrls"]:
        print("  " + u["url"])
    print(f"\nAppel de {ss._ACTORS['kleinanzeigen']} pour {a.nombre} annonces (recherche + chaque annonce)...")
    brut = ss._post(ss._ACTORS["kleinanzeigen"], payload)
    pages = [it for it in brut if isinstance(it, dict) and it.get("page") == "search"]
    for pg in pages:
        print(f"  page de resultats lue : {pg.get('found', 0)} annonce(s) trouvee(s)")
    items = [it for it in brut if isinstance(it, dict) and it.get("title")][: a.nombre]
    today = date.today()
    print(f"\n{len(items)} annonce(s) lue(s).\n")

    bilan = {"recues": len(items), "retenues": 0, "illisibles": 0, "hors_criteres": 0,
             "autre_modele": 0, "plus_de_30_jours": 0}
    for i, it in enumerate(items, 1):
        titre = it.get("title") or it.get("titre") or "(sans titre)"
        d = ss._posted_date(it, today)
        age = f"publiee le {d.isoformat()} ({(today - d).days} j)" if d else "date inconnue"
        c = ss.to_candidate(it)
        if d and (today - d).days > ss.MAX_AGE_DAYS:
            verdict, bilan["plus_de_30_jours"] = "ECARTEE : plus de 30 jours", bilan["plus_de_30_jours"] + 1
        elif c is None:
            manque = [n for n, k in (("prix", ("price", "price_eur")), ("km", ("mileage_km", "mileage", "mileageKm")),
                                     ("annee", ("year", "firstRegistration"))) if not any(it.get(x) for x in k)]
            verdict = f"ECARTEE : illisible (manque {', '.join(manque) or 'un champ'})"
            bilan["illisibles"] += 1
        elif not ss._passes(c, f):
            verdict, bilan["hors_criteres"] = "ECARTEE : hors criteres (prix, annee, km)", bilan["hors_criteres"] + 1
        elif not ss.model_in_title(a.marque, a.modele, c.titre):
            verdict, bilan["autre_modele"] = "ECARTEE : modele absent du titre", bilan["autre_modele"] + 1
        else:
            verdict, bilan["retenues"] = "RETENUE", bilan["retenues"] + 1
        print(f"{i:>2}. {titre[:70]}")
        print(f"    {it.get('url') or it.get('link') or ''}")
        print(f"    {_ligne(c) if c else 'champs lus : ' + ', '.join(sorted(k for k, v in it.items() if v not in (None, '', [], {})))[:150]}")
        print(f"    {age} -> {verdict}\n")

    print("Bilan :", json.dumps(bilan, ensure_ascii=False))
    _sauver(f"kleinanzeigen_{ss._slug(a.marque)}_{ss._slug(a.modele)}", {"payload": payload, "items": brut})
    return 0


def test_annonce(url: str) -> int:
    print(f"\nLecture de l'annonce via {ss._CHEERIO} :\n  {url}\n")
    items = ss.fetch_kleinanzeigen_ad(url)
    if not items:
        print("Aucune donnee lue : annonce supprimee, page bloquee, ou structure de la page changee.")
        return 1
    it = items[0]
    print("Donnees brutes lues sur la page :")
    print(json.dumps({k: v for k, v in it.items() if k != "description"}, ensure_ascii=False, indent=2))
    c = ss.to_candidate(it)
    print("\nResultat :", _ligne(c) if c else "INCOMPLET (prix, km ou annee manquant)")
    d = ss._posted_date(it, date.today())
    print("Date de publication :", d.isoformat() if d else "inconnue")
    _sauver("kleinanzeigen_annonce", {"url": url, "items": items})
    return 0


def _sauver(nom: str, data: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    p = OUT_DIR / f"{nom}_{date.today().isoformat()}.json"
    p.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nDonnees brutes completes enregistrees dans : {p}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Test manuel de la lecture Kleinanzeigen")
    ap.add_argument("marque", nargs="?")
    ap.add_argument("modele", nargs="?")
    ap.add_argument("--annonce", help="lien d'UNE annonce a lire (au lieu d'une recherche)")
    ap.add_argument("--nombre", type=int, default=10)
    ap.add_argument("--prix-min", type=int)
    ap.add_argument("--prix-max", type=int)
    ap.add_argument("--annee-min", type=int)
    ap.add_argument("--annee-max", type=int)
    ap.add_argument("--km-min", type=int)
    ap.add_argument("--km-max", type=int)
    a = ap.parse_args()
    if a.annonce:
        return test_annonce(a.annonce)
    if not (a.marque and a.modele):
        ap.error("indiquez une marque et un modele, ou --annonce <lien>")
    return test_recherche(a)


if __name__ == "__main__":
    sys.exit(main())
