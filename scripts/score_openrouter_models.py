import os
import json
import time
import pathlib
from typing import Dict, Any
from openai import OpenAI
from deanchor.prompts import STAGE1_SCHEMAS, STAGE2_PROMPTS
from deanchor.engine import validate_syntax

OPENROUTER_API_KEY = "YOUR_API_KEY_HERE"

client = OpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    default_headers={
        "HTTP-Referer": "https://deanchor.research.ai",
        "X-Title": "Deanchor Research"
    }
)

ROOT = pathlib.Path(__file__).resolve().parent.parent
RESULTS_FILE = ROOT / "results" / "openrouter_benchmark_results.json"

TEST_SUBJECTS = {
    "design_component": {
        "path": ROOT / "experiments" / "design" / "subject_1" / "original.html",
        "niche": "design"
    },
    "design_enterprise": {
        "path": ROOT / "experiments" / "design" / "subject_enterprise" / "original.html",
        "niche": "design"
    },
    "perf_algorithm": {
        "path": ROOT / "experiments" / "perf" / "subject_1" / "original.js",
        "niche": "perf"
    },
    "sec_auth": {
        "path": ROOT / "experiments" / "sec" / "subject_1" / "original.js",
        "niche": "sec"
    }
}

MODELS_TO_BENCHMARK = [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
]

def query_openrouter(model_id: str, prompt: str, system_prompt: str = "") -> str:
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    for attempt in range(3):
        try:
            res = client.chat.completions.create(
                model=model_id,
                messages=messages,
                temperature=0.2,
                max_tokens=3072
            )
            if res.choices and res.choices[0].message and res.choices[0].message.content:
                return res.choices[0].message.content.strip()
        except Exception as e:
            print(f"    [WARN] Attempt {attempt+1} failed: {e}. Retrying in 4s...")
            time.sleep(4)
    return ""

def run_openrouter_benchmark():
    results = {}
    print("=== Starting OpenRouter Benchmark Suite ===")
    
    for model_id in MODELS_TO_BENCHMARK:
        print(f"\n--- Benchmarking Model: {model_id} ---")
        results[model_id] = {}
        
        for subject_key, spec in TEST_SUBJECTS.items():
            print(f"  Testing subject: {subject_key} ({spec['niche']}) ...")
            code_path = spec["path"]
            if not code_path.exists():
                print(f"    [SKIP] Path {code_path} not found.")
                continue
            
            raw_code = code_path.read_text(encoding="utf-8")
            
            # Stage 1
            t0 = time.time()
            stage1_prompt = STAGE1_SCHEMAS[spec["niche"]].format(content=raw_code)
            stage1_yaml = query_openrouter(model_id, stage1_prompt)
            t1 = time.time()
            stage1_time = round(t1 - t0, 2)
            
            # Stage 2
            t2 = time.time()
            stage2_prompt = STAGE2_PROMPTS[spec["niche"]].format(schema=stage1_yaml)
            stage2_code = query_openrouter(model_id, stage2_prompt)
            t3 = time.time()
            stage2_time = round(t3 - t2, 2)
            
            # Calculate compression
            raw_len = len(raw_code)
            yaml_len = len(stage1_yaml)
            noise_filtered = round((1.0 - (yaml_len / max(raw_len, 1))) * 100, 1)
            
            # Validate syntax
            is_valid, errors = validate_syntax(stage2_code, spec["niche"])
            
            res_entry = {
                "stage1_time_sec": stage1_time,
                "stage2_time_sec": stage2_time,
                "raw_loc_bytes": raw_len,
                "yaml_loc_bytes": yaml_len,
                "noise_filtered_pct": noise_filtered,
                "syntax_valid": is_valid,
                "syntax_errors": errors,
                "stage1_yaml_snippet": stage1_yaml[:200],
                "stage2_code_snippet": stage2_code[:200]
            }
            
            results[model_id][subject_key] = res_entry
            print(f"    [DONE] S1: {stage1_time}s | S2: {stage2_time}s | Noise Filtered: {noise_filtered}% | Syntax Valid: {is_valid}")
            time.sleep(2)
            
    RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_FILE.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\n[SUCCESS] OpenRouter benchmark results saved to: {RESULTS_FILE}")

if __name__ == "__main__":
    run_openrouter_benchmark()
