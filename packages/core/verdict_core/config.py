"""Configuration pilotee par variables d'environnement."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="VERDICT_")

    env: str = "dev"
    reference_dir: str = "data/reference"
    storage_backend: str = "file"

    supabase_url: str | None = None
    supabase_key: str | None = None
    groq_api_key: str | None = None

    scraper_provider: str | None = None
    scraper_api_key: str | None = None
    scraper_country: str = "de"
    scraper_premium: bool = True
    scraper_ultra: bool = False
    apify_token: str | None = None

    # origines autorisees pour le front (dev + domaine Vercel en prod)
    cors_origins: str = "http://localhost:3000"


settings = Settings()
