import os
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    API_TOKEN: str = ""
    DATABASE_URL: str = "sqlite:///./data/untangle.db"
    DATA_DIR: str = "./data/jobs"
    
    # LLM Settings (NVIDIA API: NeMoTron-3 Ultra 550B)
    LLM_PROVIDER: str = "nvidia"
    NVIDIA_API_KEY: str = ""
    NVIDIA_API_KEY_GLM: str = ""      # Backward-compatible fallback alias
    NVIDIA_API_KEY_DEEPSEEK: str = "" # Backward-compatible fallback alias
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    
    LLM_MODEL: str = "nvidia/nemotron-3-ultra-550b-a55b"
    LLM_MODEL_FAST: str = "nvidia/nemotron-3.5-bolt-e4b"
    LLM_TIMEOUT: float = 45.0
    
    # Backward-compatible fallbacks
    GEMINI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    
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

    @property
    def effective_nvidia_api_key(self) -> str:
        return self.NVIDIA_API_KEY or self.NVIDIA_API_KEY_DEEPSEEK or self.NVIDIA_API_KEY_GLM


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    os.makedirs(settings.DATA_DIR, exist_ok=True)
    return settings
