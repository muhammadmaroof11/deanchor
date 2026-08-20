"""
Model Discovery and GPU Loader for Deanchor Engine.
"""

import sys
import pathlib
from typing import Optional, Dict, Any

try:
    from llama_cpp import Llama
except ImportError:
    Llama = None

ROOT = pathlib.Path(__file__).resolve().parent.parent
LOCAL_MODELS_DIR = ROOT / "models"
LMSTUDIO_DIR = pathlib.Path("C:/Users/SAM/.lmstudio/models")

AVAILABLE_PRESETS = {
    "gemma": "gemma-2-9b-it-Q4_K_M.gguf",
    "gemma-9b": "gemma-2-9b-it-Q4_K_M.gguf",
    "mistral": "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
    "mistral-7b": "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
    "llama": "Meta-Llama-3_1-8B-Instruct-IQ4_XS/model.gguf",
    "llama-8b": "Meta-Llama-3_1-8B-Instruct-IQ4_XS/model.gguf",
    "qwen": "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    "qwen-7b": "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
}


def find_model_path(identifier: str) -> Optional[pathlib.Path]:
    """Find GGUF model file across presets and local directories."""
    target = AVAILABLE_PRESETS.get(identifier.lower(), identifier)
    
    # Direct path
    p = pathlib.Path(target)
    if p.is_file():
        return p

    # Search in models/ and .lmstudio/
    for base in [LOCAL_MODELS_DIR, LMSTUDIO_DIR]:
        if not base.exists():
            continue
        exact = base / target
        if exact.is_file():
            return exact
        # Subdirectory search
        for f in base.glob(f"**/*{target}*"):
            if f.is_file() and f.suffix == ".gguf":
                return f

    return None


def get_default_model_path() -> pathlib.Path:
    """Return the highest-performing available model (Gemma 2 9B -> Mistral 7B -> Llama 3.1 8B -> Qwen 2.5 7B)."""
    priority_order = ["gemma", "mistral", "llama", "qwen"]
    for key in priority_order:
        p = find_model_path(key)
        if p and p.is_file():
            return p
    
    # Fallback to any gguf in models/
    for f in LOCAL_MODELS_DIR.glob("**/*.gguf"):
        return f

    raise FileNotFoundError("No GGUF models found in models/ or C:/Users/SAM/.lmstudio/models/")


def load_llm(
    model_identifier: Optional[str] = None,
    n_ctx: int = 8192,
    n_gpu_layers: int = -1,
    verbose: bool = False
) -> "Llama":
    """Load LLM into GPU memory using llama-cpp-python."""
    if Llama is None:
        raise ImportError("llama-cpp-python is required to run local LLMs. Install via pip install llama-cpp-python.")

    if model_identifier and model_identifier.lower() != "auto":
        model_path = find_model_path(model_identifier)
        if not model_path:
            raise FileNotFoundError(f"Model '{model_identifier}' not found in presets or models directories.")
    else:
        model_path = get_default_model_path()

    llm = Llama(
        model_path=str(model_path),
        n_ctx=n_ctx,
        n_gpu_layers=n_gpu_layers,
        n_threads=8,
        verbose=verbose
    )
    return llm
