import os
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    API_TOKEN: str = ""
    DATABASE_URL: str = "sqlite:///./data/untangle.db"
    DATA_DIR: str = "./data/jobs"
    
    LLM_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    LLM_MODEL_FAST: str = "gemini-1.5-flash"
    LLM_MODEL_STRONG: str = "gemini-1.5-pro"
    
    CONF_AUTO_THRESHOLD: float = 0.85
    CONF_REVIEW_THRESHOLD: float = 0.60
    
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:80"

    # Multi-signal confidence weights per ARCHITECTURE.md
    W_OCR: float = 0.20
    W_SYM: float = 0.20
    W_IO: float = 0.30
    W_ISA: float = 0.15
    W_LLM: float = 0.15

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    os.makedirs(settings.DATA_DIR, exist_ok=True)
    return settings
