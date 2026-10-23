"""Recuperation HTML, hors chemin critique.

Trois niveaux, dans l'ordre :
1. cache disque ;
2. API de scraping (ScraperAPI/ScrapingBee) si configuree : proxy + rendu JS,
   c'est ce qui franchit l'anti-bot de mobile.de ;
3. Playwright furtif en repli, avec gestion du mur de consentement."""
from __future__ import annotations

import hashlib
import random
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen

from ...config import settings

CACHE_DIR = Path("data/snapshots/html")

_CONSENT_SELECTORS = [
    'button[title="Alle akzeptieren"]',
    'button:has-text("Alle akzeptieren")',
    'button:has-text("Akzeptieren und weiter")',
    'button:has-text("Accept all")',
    'button:has-text("Tout accepter")',
    'button[aria-label*="akzeptieren"]',
]
_CONTENT_SELECTOR = '[data-testid="listing-details-attributes"]'


def _cache_path(url: str) -> Path:
    h = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
    return CACHE_DIR / f"{h}.html"


def _bool(v: bool) -> str:
    return "true" if v else "false"


def _fetch_via_api(url: str, timeout: int = 90) -> str:
    """Passe par une API de scraping (proxy + rendu JS).
    Remonte le message d'erreur du service pour diagnostic."""
    key = settings.scraper_api_key
    prov = settings.scraper_provider
    country = settings.scraper_country

    if prov == "scraperapi":
        params = {"api_key": key, "url": url, "render": "true"}
        if country:
            params["country_code"] = country
        if settings.scraper_ultra:
            params["ultra_premium"] = "true"
        elif settings.scraper_premium:
            params["premium"] = "true"
        endpoint = f"https://api.scraperapi.com/?{urlencode(params)}"
    elif prov == "scrapingbee":
        params = {"api_key": key, "url": url, "render_js": "true",
                  "premium_proxy": _bool(settings.scraper_premium or settings.scraper_ultra)}
        if country:
            params["country_code"] = country
        endpoint = f"https://app.scrapingbee.com/api/v1/?{urlencode(params)}"
    else:
        raise ValueError(f"scraper_provider inconnu: {prov}")

    try:
        with urlopen(endpoint, timeout=timeout) as r:
            return r.read().decode("utf-8", errors="ignore")
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")[:400]
        raise RuntimeError(f"{prov} HTTP {e.code} : {body}") from None


def _fetch_via_playwright(url: str, headless: bool, timeout_ms: int) -> str:
    from playwright.sync_api import sync_playwright
    try:
        from playwright_stealth import stealth_sync
    except ImportError:
        stealth_sync = None

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        ctx = browser.new_context(
            locale="de-DE",
            user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0 Safari/537.36"),
        )
        page = ctx.new_page()
        if stealth_sync:
            stealth_sync(page)
        page.goto(url, timeout=timeout_ms, wait_until="domcontentloaded")

        for fr in [page, *page.frames]:
            for sel in _CONSENT_SELECTORS:
                try:
                    loc = fr.locator(sel).first
                    if loc.count() > 0:
                        loc.click(timeout=3000)
                        page.wait_for_load_state("networkidle", timeout=timeout_ms)
                        break
                except Exception:
                    continue

        try:
            page.wait_for_selector(_CONTENT_SELECTOR, timeout=15000)
        except Exception:
            pass

        html = page.content()
        browser.close()
    return html


def fetch_html(url: str, use_cache: bool = True, min_delay: float = 1.5,
               max_delay: float = 4.0, timeout_ms: int = 45000,
               headless: bool = True) -> str:
    cache = _cache_path(url)
    if use_cache and cache.exists():
        return cache.read_text(encoding="utf-8")

    if settings.scraper_provider and settings.scraper_api_key:
        html = _fetch_via_api(url)
    else:
        time.sleep(random.uniform(min_delay, max_delay))
        html = _fetch_via_playwright(url, headless=headless, timeout_ms=timeout_ms)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache.write_text(html, encoding="utf-8")
    return html
