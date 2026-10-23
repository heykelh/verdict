"""Configuration pilotee par variables d'environnement.
Dev interne et prod publique = memes fichiers, config differente."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="VERDICT_")

    env: str = "dev"
    reference_dir: str = "data/reference"
    storage_backend: str = "file"           # file | supabase (P2)

    supabase_url: str | None = None
    supabase_key: str | None = None
    groq_api_key: str | None = None

    # API de scraping (proxy + rendu JS) pour franchir l'anti-bot
    scraper_provider: str | None = None     # "scraperapi" | "scrapingbee" | None
    scraper_api_key: str | None = None
    scraper_country: str = "de"
    scraper_premium: bool = True            # proxys residentiels (sites proteges)
    scraper_ultra: bool = False 
    apify_token: str | None = None            # escalade sites tres proteges (couteux)


settings = Settings()
