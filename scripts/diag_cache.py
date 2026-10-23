"""Diagnostic du cache de snapshots : annonces parsables + detection consentement."""
from pathlib import Path

from verdict_core.adapters.scrapers._mobile_parser import parse_listings

MOTS = ["Einwilligung", "Zustimmung", "consent", "Ich stimme",
        "Cookies akzeptieren", "gdpr-consent", "Alle akzeptieren"]

cache = Path("data/snapshots/html")
for f in sorted(cache.glob("*.html"), key=lambda p: p.stat().st_size):
    html = f.read_text(encoding="utf-8", errors="ignore")
    n = len(parse_listings(html))
    consent = [m for m in MOTS if m.lower() in html.lower()]
    flag = consent[:3] if consent else "non"
    print(f"{f.name}  {f.stat().st_size:>9} o  ->  {n:>2} annonces  | consentement: {flag}")
