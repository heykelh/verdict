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


settings = Settings()
