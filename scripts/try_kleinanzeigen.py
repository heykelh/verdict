"""Dump d'un item brut kleinanzeigen pour caler le mapping."""
import json

from verdict_core.adapters.scrapers.search_sources import _ACTORS, _payload, _post

items = _post(_ACTORS["kleinanzeigen"],
              _payload("kleinanzeigen", "BMW", "320", None, None, None, 5))
print("items recus :", len(items))
if items:
    print(json.dumps(items[0], indent=2, ensure_ascii=False)[:2500])
