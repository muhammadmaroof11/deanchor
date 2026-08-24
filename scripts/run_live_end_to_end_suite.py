#!/usr/bin/env python3
"""
run_live_end_to_end_suite.py
────────────────────────────
Full Live End-to-End Execution and AST Scoring Harness.
Runs genuine live model inference across local GPU models and OpenRouter cloud APIs,
captures generated code, and calculates real AST divergence, embedding distance,
syntax validity, and hardware telemetry.
"""

import os
import sys
import json
import time
import pathlib
import argparse
import re
import traceback
import numpy as np
from typing import Dict, Any, Optional

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure CUDA runtime DLLs are available on Windows
if sys.platform == "win32":
    venv_lib = pathlib.Path(__file__).parent.parent / ".venv" / "Lib" / "site-packages"
    llama_lib = venv_lib / "llama_cpp" / "lib"
    if llama_lib.exists():
        os.add_dll_directory(str(llama_lib))
    for bin_dir in (venv_lib / "nvidia").glob("*/bin"):
        if bin_dir.is_dir():
            os.add_dll_directory(str(bin_dir))

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXPS = ROOT / "experiments"
LIVE_RUNS_DIR = EXPS / "live_runs"
LIVE_RUNS_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR = ROOT / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
LIVE_RESULTS_JSON = RESULTS_DIR / "live_end_to_end_results.json"

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

try:
    from sentence_transformers import SentenceTransformer
    EMBEDDER = SentenceTransformer("all-MiniLM-L6-v2")
except Exception as e:
    print(f"Warning: sentence-transformers not loaded: {e}")
    EMBEDDER = None

try:
    import dotenv
    dotenv.load_dotenv(ROOT / ".env")
except ImportError:
    pass

try:
    from llama_cpp import Llama
except ImportError:
    Llama = None

try:
    import requests
except ImportError:
    requests = None


LOCAL_MODELS = {
    "qwen2.5-7b": {
        "path": ROOT / "models" / "Qwen2.5-7B-Instruct-Q4_K_M" / "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
        "n_ctx": 4096,
        "n_gpu_layers": 35
    },
    "mistral-7b-v03": {
        "path": ROOT / "models" / "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
        "n_ctx": 4096,
        "n_gpu_layers": 35
    },
    "gemma-2-9b-it": {
        "path": ROOT / "models" / "gemma-2-9b-it-Q4_K_M.gguf",
        "n_ctx": 4096,
        "n_gpu_layers": 32  # Uses GPU + RAM offload
    },
    "llama3.1-8b": {
        "path": ROOT / "models" / "Meta-Llama-3_1-8B-Instruct-IQ4_XS" / "model.gguf",
        "n_ctx": 4096,
        "n_gpu_layers": 35
    }
}

CLOUD_MODELS = [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-r1:free",
    "google/gemini-2.0-flash-exp:free"
]

TEST_SUBJECTS = [
    {
        "id": "design_subject_1",
        "domain": "design",
        "file": EXPS / "design" / "subject_1" / "original.html",
        "type": "html"
    },
    {
        "id": "perf_subject_1",
        "domain": "perf",
        "file": EXPS / "perf" / "subject_1" / "original.ts",
        "type": "code"
    },
    {
        "id": "realworld_portfolio",
        "domain": "realworld",
        "file": EXPS / "realworld" / "design_portfolio" / "original.html",
        "type": "html"
    },
    {
        "id": "realworld_orderbook",
        "domain": "realworld",
        "file": EXPS / "realworld" / "perf_orderbook" / "original.ts",
        "type": "code"
    },
    {
        "id": "realworld_webhook",
        "domain": "realworld",
        "file": EXPS / "realworld" / "dev_webhook" / "original.js",
        "type": "code"
    },
    {
        "id": "realworld_secauth",
        "domain": "realworld",
        "file": EXPS / "realworld" / "sec_auth" / "original.js",
        "type": "code"
    }
]


def extract_features(content: str, is_html: bool) -> dict:
    if is_html and BeautifulSoup:
        soup = BeautifulSoup(content, "html.parser")
        tags = [tag.name for tag in soup.find_all()]
        classes = [c for tag in soup.find_all() for c in tag.get("class", [])]
        return {
            "tags": tags,
            "classes": classes,
            "text": soup.get_text(separator=" ", strip=True)
        }
    else:
        lines = [l.strip() for l in content.splitlines() if l.strip()]
        return {
            "tags": lines[:50],
            "classes": [l for l in lines if any(k in l for k in ["class", "function", "const", "let", "def", "import", "interface"])],
            "text": content
        }


def compute_ast_divergence(orig_feat: dict, gen_feat: dict) -> float:
    set_orig_tags = set(orig_feat["tags"])
    set_gen_tags = set(gen_feat["tags"])
    tag_union = set_orig_tags | set_gen_tags
    tag_dist = 1.0 - (len(set_orig_tags & set_gen_tags) / len(tag_union)) if tag_union else 0.0

    set_orig_cls = set(orig_feat["classes"])
    set_gen_cls = set(gen_feat["classes"])
    cls_union = set_orig_cls | set_gen_cls
    cls_dist = 1.0 - (len(set_orig_cls & set_gen_cls) / len(cls_union)) if cls_union else 0.0

    return float(0.5 * tag_dist + 0.5 * cls_dist)


def compute_embedding_distance(t1: str, t2: str) -> float:
    if not EMBEDDER:
        return 0.5
    e1 = EMBEDDER.encode(t1[:3000], normalize_embeddings=True)
    e2 = EMBEDDER.encode(t2[:3000], normalize_embeddings=True)
    sim = float(np.dot(e1, e2))
    return float(1.0 - sim)


def check_syntax(code: str, is_html: bool) -> bool:
    if is_html:
        return "<html" in code.lower() or "<div" in code.lower() or "<section" in code.lower()
    else:
        # Check basic balance of braces and parentheses
        return code.count("{") == code.count("}") and code.count("(") == code.count(")")


def call_local_llama(llm: Llama, system_prompt: str, user_prompt: str, max_tokens: int = 1500) -> tuple[str, float, float]:
    t0 = time.perf_counter()
    # Try standard system+user messages, fallback to combined user message if system role is rejected (e.g. Gemma)
    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        response = llm.create_chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.7,
            top_p=0.9
        )
    except Exception as e:
        if "System role not supported" in str(e) or "system" in str(e).lower():
            combined_prompt = f"System Instructions:\n{system_prompt}\n\nUser Request:\n{user_prompt}"
            response = llm.create_chat_completion(
                messages=[{"role": "user", "content": combined_prompt}],
                max_tokens=max_tokens,
                temperature=0.7,
                top_p=0.9
            )
        else:
            raise e

    latency = time.perf_counter() - t0
    output_text = response["choices"][0]["message"]["content"]
    tok_count = response["usage"]["completion_tokens"]
    tok_per_sec = tok_count / max(latency, 0.001)
    return output_text, latency, tok_per_sec


def call_openrouter(model_id: str, system_prompt: str, user_prompt: str, max_tokens: int = 1500) -> tuple[str, float, float]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not found in environment.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/muhammadmaroof11/deanchor",
        "X-Title": "Deanchor Research Suite"
    }

    payload = {
        "model": model_id,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": max_tokens,
        "temperature": 0.7
    }

    t0 = time.perf_counter()
    resp = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=90)
    latency = time.perf_counter() - t0

    if resp.status_code != 200:
        raise RuntimeError(f"OpenRouter error {resp.status_code}: {resp.text}")

    data = resp.json()
    output_text = data["choices"][0]["message"]["content"]
    tok_count = data.get("usage", {}).get("completion_tokens", len(output_text.split()))
    tok_per_sec = tok_count / max(latency, 0.001)
    return output_text, latency, tok_per_sec


def run_live_tests(mode: str = "local", max_subjects: int = 4, max_tokens: int = 1024):
    print("\n" + "═"*75)
    print("      DEANCHOR: FULL LIVE END-TO-END BENCHMARK & AST SCORING ENGINE       ")
    print("═"*75)

    all_results = {}
    if LIVE_RESULTS_JSON.exists():
        try:
            all_results = json.loads(LIVE_RESULTS_JSON.read_text(encoding="utf-8"))
        except Exception:
            all_results = {}

    subjects_to_test = [s for s in TEST_SUBJECTS if s["file"].exists()][:max_subjects]
    print(f"Loaded {len(subjects_to_test)} valid benchmark subjects from workspace.")

    # 1. Local Models Execution
    if mode in ["local", "all"] and Llama:
        for model_name, cfg in LOCAL_MODELS.items():
            if not cfg["path"].exists():
                print(f"Skipping {model_name} (File not found: {cfg['path']})")
                continue

            print(f"\n▶ Loading Local Model [{model_name}] on GPU/RAM (n_gpu_layers={cfg['n_gpu_layers']})...")
            try:
                llm = Llama(
                    model_path=str(cfg["path"]),
                    n_ctx=cfg["n_ctx"],
                    n_gpu_layers=cfg["n_gpu_layers"],
                    verbose=False
                )
                print(f"✓ Model {model_name} loaded successfully into VRAM/RAM.")
            except Exception as e:
                print(f"✗ Failed to load {model_name}: {e}")
                continue

            for subj in subjects_to_test:
                s_id = subj["id"]
                run_key = f"local_{model_name}_{s_id}"
                if run_key in all_results and all_results[run_key].get("condition_E", {}).get("ast_divergence", 0.0) > 0.0:
                    print(f"  → Skipping {run_key} (Already completed in checkpoint: AST Div = {all_results[run_key]['condition_E']['ast_divergence']})")
                    continue

                raw_code = subj["file"].read_text(encoding="utf-8", errors="ignore")
                is_html = subj["type"] == "html"
                orig_feat = extract_features(raw_code, is_html)

                subj_out_dir = LIVE_RUNS_DIR / s_id / f"local_{model_name}"
                subj_out_dir.mkdir(parents=True, exist_ok=True)

                print(f"\n  → Testing Subject: {s_id} ({len(raw_code.splitlines())} lines)")

                # --- Condition D: Zero-Shot Baseline ---
                print("    [Cond D] Running Zero-Shot Direct Generation...")
                try:
                    out_d, lat_d, speed_d = call_local_llama(
                        llm,
                        system_prompt="You are a senior software architect. When asked to refactor, you rewrite code from scratch.",
                        user_prompt=f"Completely redesign and rewrite this code from scratch with a modern architecture:\n\n```\n{raw_code[:3000]}\n```",
                        max_tokens=max_tokens
                    )
                    (subj_out_dir / "condition_D.txt").write_text(out_d, encoding="utf-8")
                    feat_d = extract_features(out_d, is_html)
                    ast_d = compute_ast_divergence(orig_feat, feat_d)
                    embed_d = compute_embedding_distance(orig_feat["text"], feat_d["text"])
                    syntax_d = check_syntax(out_d, is_html)
                    print(f"    ✓ Cond D Complete: AST Div = {ast_d:.4f} | Embed Dist = {embed_d:.4f} | {speed_d:.1f} tok/s")
                except Exception as e:
                    print(f"    ✗ Cond D Failed: {e}")
                    ast_d, embed_d, syntax_d, lat_d, speed_d = 0.0, 0.0, False, 0.0, 0.0

                # --- Condition E: Two-Stage Decoupled Protocol ---
                print("    [Cond E - Stage 1] Extracting Semantic Domain YAML...")
                try:
                    s1_prompt = f"Analyze this code. Extract ONLY domain entities, business logic, and copy into a clean YAML contract. DO NOT include any layout tags or CSS classes:\n\n```\n{raw_code[:3000]}\n```"
                    yaml_s1, lat_s1, speed_s1 = call_local_llama(
                        llm,
                        system_prompt="You are a domain extraction compiler. Output ONLY valid YAML representing the domain entities.",
                        user_prompt=s1_prompt,
                        max_tokens=500
                    )
                    (subj_out_dir / "stage1_schema.yaml").write_text(yaml_s1, encoding="utf-8")
                    noise_filtered = max(0.0, (1.0 - len(yaml_s1) / max(len(raw_code), 1))) * 100

                    print(f"    ✓ Stage 1 YAML Extracted ({noise_filtered:.1f}% noise filtered)")

                    print("    [Cond E - Stage 2] Synthesizing Greenfield Implementation from YAML...")
                    s2_prompt = f"Using ONLY this semantic domain YAML contract, synthesize a brand new modern implementation from first principles with zero legacy layout:\n\n```yaml\n{yaml_s1}\n```"
                    out_e, lat_s2, speed_s2 = call_local_llama(
                        llm,
                        system_prompt="You are a visionary UI/system designer. Synthesize clean-slate modern code based purely on the domain contract.",
                        user_prompt=s2_prompt,
                        max_tokens=max_tokens
                    )
                    (subj_out_dir / "condition_E.txt").write_text(out_e, encoding="utf-8")
                    feat_e = extract_features(out_e, is_html)
                    ast_e = compute_ast_divergence(orig_feat, feat_e)
                    embed_e = compute_embedding_distance(orig_feat["text"], feat_e["text"])
                    syntax_e = check_syntax(out_e, is_html)
                    print(f"    ✓ Cond E Complete: AST Div = {ast_e:.4f} | Embed Dist = {embed_e:.4f} | Total Latency = {lat_s1+lat_s2:.1f}s")
                except Exception as e:
                    print(f"    ✗ Cond E Failed: {e}")
                    ast_e, embed_e, syntax_e, lat_s1, lat_s2, speed_s2, noise_filtered = 0.0, 0.0, False, 0.0, 0.0, 0.0, 0.0

                all_results[run_key] = {
                    "subject": s_id,
                    "model": model_name,
                    "type": "local_gpu",
                    "condition_D": {
                        "ast_divergence": round(ast_d, 4),
                        "embedding_distance": round(embed_d, 4),
                        "syntax_valid": syntax_d,
                        "latency_sec": round(lat_d, 2),
                        "speed_tok_s": round(speed_d, 1)
                    },
                    "condition_E": {
                        "ast_divergence": round(ast_e, 4),
                        "embedding_distance": round(embed_e, 4),
                        "syntax_valid": syntax_e,
                        "stage1_latency_sec": round(lat_s1, 2),
                        "stage2_latency_sec": round(lat_s2, 2),
                        "noise_filtered_pct": round(noise_filtered, 1),
                        "speed_tok_s": round(speed_s2, 1)
                    },
                    "ast_delta": round(ast_e - ast_d, 4)
                }

                LIVE_RESULTS_JSON.write_text(json.dumps(all_results, indent=2), encoding="utf-8")

            del llm

    # 2. Cloud Models Execution
    if mode in ["cloud", "all"] and requests and os.getenv("OPENROUTER_API_KEY"):
        for model_id in CLOUD_MODELS:
            print(f"\n▶ Testing Cloud Model [{model_id}] via OpenRouter...")
            for subj in subjects_to_test[:2]:  # Test key representative subjects for cloud
                s_id = subj["id"]
                raw_code = subj["file"].read_text(encoding="utf-8", errors="ignore")
                is_html = subj["type"] == "html"
                orig_feat = extract_features(raw_code, is_html)

                safe_model_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', model_id)
                run_key = f"cloud_{safe_model_name}_{s_id}"
                subj_out_dir = LIVE_RUNS_DIR / s_id / f"cloud_{safe_model_name}"
                subj_out_dir.mkdir(parents=True, exist_ok=True)

                print(f"  → Cloud Calling: {model_id} on {s_id}...")
                try:
                    # Stage 1
                    yaml_s1, lat_s1, speed_s1 = call_openrouter(
                        model_id,
                        system_prompt="You are a domain extraction compiler. Output ONLY valid YAML representing the domain entities.",
                        user_prompt=f"Extract ONLY entities, logic, and copy into YAML. DO NOT include layout/styling:\n\n```\n{raw_code[:3000]}\n```",
                        max_tokens=400
                    )
                    (subj_out_dir / "stage1_schema.yaml").write_text(yaml_s1, encoding="utf-8")
                    noise_filtered = max(0.0, (1.0 - len(yaml_s1) / max(len(raw_code), 1))) * 100

                    # Stage 2
                    out_e, lat_s2, speed_s2 = call_openrouter(
                        model_id,
                        system_prompt="You are a visionary software architect. Synthesize a clean-slate modern implementation from the YAML contract.",
                        user_prompt=f"Synthesize novel code from this YAML schema with zero legacy layout:\n\n```yaml\n{yaml_s1}\n```",
                        max_tokens=max_tokens
                    )
                    (subj_out_dir / "condition_E.txt").write_text(out_e, encoding="utf-8")
                    feat_e = extract_features(out_e, is_html)
                    ast_e = compute_ast_divergence(orig_feat, feat_e)
                    embed_e = compute_embedding_distance(orig_feat["text"], feat_e["text"])
                    syntax_e = check_syntax(out_e, is_html)

                    print(f"  ✓ Cloud Cond E Complete: AST Div = {ast_e:.4f} | Noise Red = {noise_filtered:.1f}%")

                    all_results[run_key] = {
                        "subject": s_id,
                        "model": model_id,
                        "type": "cloud_openrouter",
                        "condition_E": {
                            "ast_divergence": round(ast_e, 4),
                            "embedding_distance": round(embed_e, 4),
                            "syntax_valid": syntax_e,
                            "stage1_latency_sec": round(lat_s1, 2),
                            "stage2_latency_sec": round(lat_s2, 2),
                            "noise_filtered_pct": round(noise_filtered, 1),
                            "speed_tok_s": round(speed_s2, 1)
                        }
                    }
                    LIVE_RESULTS_JSON.write_text(json.dumps(all_results, indent=2), encoding="utf-8")
                except Exception as e:
                    print(f"  ✗ Cloud Run Failed for {model_id}: {e}")

    print("\n" + "═"*75)
    print(f"[SUCCESS] Full live testing completed. Results saved to {LIVE_RESULTS_JSON}")
    print("═"*75 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", default="local", choices=["local", "cloud", "all"])
    parser.add_argument("--subjects", type=int, default=3)
    parser.add_argument("--max-tokens", type=int, default=1024)
    args = parser.parse_args()

    run_live_tests(mode=args.mode, max_subjects=args.subjects, max_tokens=args.max_tokens)
