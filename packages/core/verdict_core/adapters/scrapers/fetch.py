"""Recuperation HTML via navigateur furtif, hors chemin critique.
Gere le mur de consentement (CMP) et attend le rendu des annonces.
Cache disque : on ne retape pas le site a chaque test."""
from __future__ import annotations

import hashlib
import random
import time
from pathlib import Path

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


def _accept_consent(page) -> bool:
    # le bouton d'acceptation est souvent dans une iframe CMP (Sourcepoint)
    for ctx in [page, *page.frames]:
        for sel in _CONSENT_SELECTORS:
            try:
                loc = ctx.locator(sel).first
                if loc.count() > 0:
                    loc.click(timeout=3000)
                    return True
            except Exception:
                continue
    return False


def fetch_html(url: str, use_cache: bool = True, min_delay: float = 1.5,
               max_delay: float = 4.0, timeout_ms: int = 45000,
               headless: bool = True) -> str:
    cache = _cache_path(url)
    if use_cache and cache.exists():
        return cache.read_text(encoding="utf-8")

    from playwright.sync_api import sync_playwright
    try:
        from playwright_stealth import stealth_sync
    except ImportError:
        stealth_sync = None

    time.sleep(random.uniform(min_delay, max_delay))
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

        if _accept_consent(page):
            try:
                page.wait_for_load_state("networkidle", timeout=timeout_ms)
            except Exception:
                pass

        # attendre le rendu des annonces, sinon prendre ce qui est la
        try:
            page.wait_for_selector(_CONTENT_SELECTOR, timeout=15000)
        except Exception:
            pass

        html = page.content()
        browser.close()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache.write_text(html, encoding="utf-8")
    return html
