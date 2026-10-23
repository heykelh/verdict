"""Test de la source mobile.de via Apify + inspection des champs bruts."""
import json
import statistics as s

from verdict_core.adapters.scrapers import apify_mobile
from verdict_core.market_types import SearchCriteria

crit = SearchCriteria(marque="BMW", modele="320d", annee=2020, km=100000)

items = apify_mobile.run_actor(crit, max_results=30)
print("items bruts recus :", len(items))
if items:
    print("\n--- 1er item brut (pour verrouiller le mapping) ---")
    print(json.dumps(items[0], indent=2, ensure_ascii=False)[:1500])

comps = [c for it in items if (c := apify_mobile.to_comparable(it))]
print("\ncomparables mappes :", len(comps))
for c in comps[:8]:
    print(f"  {c.annee} | {c.km:>7} km | {int(c.prix_eur):>6} EUR | {c.motorisation}")
if comps:
    px = [c.prix_eur for c in comps]
    print("mediane :", int(s.median(px)))
