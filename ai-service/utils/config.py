"""Environment configuration for the AI service."""
import os

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover - dotenv optional in tests
    pass


class Settings:
    ai_service_key: str = os.getenv("AI_SERVICE_KEY", "dev-internal-key")
    hf_api_token: str = os.getenv("HF_API_TOKEN", "")
    hf_inference_url: str = os.getenv(
        "HF_INFERENCE_URL",
        "https://router.huggingface.co/hf-inference/models/openai/clip-vit-base-patch32",
    )
    llm_api_key: str = os.getenv("LLM_API_KEY", "")
    llm_base_url: str = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    llm_model: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
    llm_timeout: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "20"))

    @property
    def vision_enabled(self) -> bool:
        return bool(self.hf_api_token)

    @property
    def llm_enabled(self) -> bool:
        return bool(self.llm_api_key)


settings = Settings()
