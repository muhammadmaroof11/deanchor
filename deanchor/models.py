"""
Model Discovery and Cloud/Local Provider Interface for Deanchor Engine.
Supports Google Gemini, OpenRouter, and standard OpenAI-compatible API endpoints.
"""

import os
import json
import time
import pathlib
import urllib.request
import urllib.error
from typing import Optional, Dict, Any, Tuple

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Load .env if present
env_file = ROOT / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

AVAILABLE_PRESETS = {
    "gemini": "gemini-2.5-flash",
    "gemini-flash": "gemini-2.5-flash",
    "gemini-3.6": "gemini-3.6-flash",
    "nemotron": "nvidia/nemotron-3-super-120b-a12b:free",
    "llama-cloud": "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek-cloud": "deepseek/deepseek-r1:free",
}

# Models that route to specific providers (overrides key-based detection)
MODEL_PROVIDER_MAP = {
    # Groq models — add entries here when a valid GROQ_API_KEY is available
}


def get_default_provider_and_model(model_name: Optional[str] = None) -> Tuple[str, str, str, str]:
    """
    Returns (provider, base_url, api_key, model_id).
    Routes to the correct provider based on model name or available API keys.
    """
    chosen_model = model_name or os.getenv("DEANCHOR_MODEL")

    gemini_key = os.getenv("GEMINI_API_KEY", "")
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
    groq_key = os.getenv("GROQ_API_KEY", "")

    if chosen_model and chosen_model.lower() in AVAILABLE_PRESETS:
        chosen_model = AVAILABLE_PRESETS[chosen_model.lower()]

    # Check if the chosen model maps to a specific provider
    if chosen_model and chosen_model in MODEL_PROVIDER_MAP:
        provider = MODEL_PROVIDER_MAP[chosen_model]
        if provider == "groq" and groq_key:
            return ("groq", "https://api.groq.com/openai/v1", groq_key, chosen_model)

    # Explicit provider selection via DEANCHOR_PROVIDER env var
    forced_provider = os.getenv("DEANCHOR_PROVIDER", "").lower()
    if forced_provider == "groq" and groq_key:
        model_id = chosen_model or "llama-3.3-70b-versatile"
        return ("groq", "https://api.groq.com/openai/v1", groq_key, model_id)

    if gemini_key and forced_provider != "groq":
        model_id = chosen_model or "gemini-2.5-flash"
        return (
            "gemini",
            "https://generativelanguage.googleapis.com/v1beta/openai",
            gemini_key,
            model_id
        )
    elif groq_key:
        model_id = chosen_model or "llama-3.3-70b-versatile"
        return ("groq", "https://api.groq.com/openai/v1", groq_key, model_id)
    elif openrouter_key:
        model_id = chosen_model or "nvidia/nemotron-3-super-120b-a12b:free"
        return (
            "openrouter",
            "https://openrouter.ai/api/v1",
            openrouter_key,
            model_id
        )
    else:
        model_id = chosen_model or "gemini-2.5-flash"
        return (
            "gemini",
            "https://generativelanguage.googleapis.com/v1beta/openai",
            "",
            model_id
        )


class CloudLLMClient:
    """Zero-dependency HTTP client for cloud inference endpoints."""

    def __init__(self, base_url: str, api_key: str, model_id: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model_id = model_id

    def create_chat_completion(
        self,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        top_p: float = 0.95
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "DeanchorEngine/2.0"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": self.model_id,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p
        }

        # Retry loop for rate limits and transient errors
        max_retries = 5
        for attempt in range(1, max_retries + 1):
            # Rebuild request each attempt (urllib consumes the data stream)
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=180) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    return data
            except urllib.error.HTTPError as e:
                if e.code in (429, 503) and attempt < max_retries:
                    wait = 20.0 * attempt if e.code == 503 else 15.0 * attempt
                    print(f"  [retry] HTTP {e.code}, waiting {wait:.0f}s (attempt {attempt}/{max_retries})")
                    time.sleep(wait)
                    continue
                err_body = e.read().decode("utf-8", errors="ignore")
                raise RuntimeError(f"HTTP {e.code} from {url}: {err_body}")
            except Exception as e:
                if attempt < max_retries:
                    time.sleep(10.0)
                    continue
                raise e

        raise RuntimeError("Failed to complete inference request after retries.")


def load_llm(model_identifier: Optional[str] = None) -> CloudLLMClient:
    """Load cloud LLM client interface."""
    provider, base_url, api_key, model_id = get_default_provider_and_model(model_identifier)
    return CloudLLMClient(base_url=base_url, api_key=api_key, model_id=model_id)
