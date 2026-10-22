"""Recuperation HTML via navigateur furtif, hors chemin critique.
Cache disque : on ne retape pas le site a chaque test."""
from __future__ import annotations

import hashlib
import random
import time
from pathlib import Path

CACHE_DIR = Path("data/snapshots/html")


def _cache_path(url: str) -> Path:
    h = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
    return CACHE_DIR / f"{h}.html"


def fetch_html(url: str, use_cache: bool = True, min_delay: float = 1.5,
               max_delay: float = 4.0, timeout_ms: int = 30000) -> str:
    cache = _cache_path(url)
    if use_cache and cache.exists():
        return cache.read_text(encoding="utf-8")

    # import local : Playwright n'est tire que si on scrape reellement
    from playwright.sync_api import sync_playwright
    try:
        from playwright_stealth import stealth_sync
    except ImportError:
        stealth_sync = None

    time.sleep(random.uniform(min_delay, max_delay))
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"))
        if stealth_sync:
            stealth_sync(page)
        page.goto(url, timeout=timeout_ms, wait_until="domcontentloaded")
        html = page.content()
        browser.close()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache.write_text(html, encoding="utf-8")
    return html
