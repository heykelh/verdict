"""Test diagnostic du scraping live mobile.de, en navigateur VISIBLE."""
from verdict_core.adapters.scrapers._mobile_parser import parse_listings
from verdict_core.adapters.scrapers.fetch import fetch_html

URL = ("https://suchen.mobile.de/fahrzeuge/search.html"
       "?dam=false&isSearchRequest=true&ms=3500%3B%3B21%3B320d&s=Car&vc=Car")

# headless=False : une fenetre Chrome s'ouvre, tu vois ce que le bot voit
html = fetch_html(URL, use_cache=False, headless=False)

print("taille HTML :", len(html))
print("annonces parsees :", len(parse_listings(html)))
low = html.lower()
for marqueur in ["listing-details-attributes", "captcha", "consent",
                 "gdpr", "zugriff", "verdächtig", "blocked", "robot"]:
    print(f"  {marqueur:>26} : {low.count(marqueur)}")
