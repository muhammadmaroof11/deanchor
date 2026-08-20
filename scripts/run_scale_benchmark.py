#!/usr/bin/env python3
"""
Scale & Cross-Architecture Benchmark Harness for Deanchoring Research.
Compares 7B vs 8B vs 9B vs 12B vs 30B models on RTX 3080 GPU across Condition D (Control) and Condition E (Two-Stage Decoupled).
"""

import sys
import json
import time
import pathlib
import argparse
from typing import Dict, Any, Optional

try:
    from llama_cpp import Llama
except ImportError:
    print("Error: llama-cpp-python is required.")
    sys.exit(1)

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"
LMSTUDIO_MODELS_DIR = pathlib.Path("C:/Users/SAM/.lmstudio/models")
EXPS = ROOT / "experiments"
RESULTS_DIR = ROOT / "results"
RESULTS_DIR.mkdir(exist_ok=True)

# Candidate Models for Cross-Architecture Scaling
CANDIDATE_MODELS = {
    "qwen2.5-7b": {
        "name": "Qwen 2.5 7B (Q4_K_M)",
        "path": "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
        "scale": "7B",
        "arch": "Qwen"
    },
    "mistral-7b-v03": {
        "name": "Mistral 7B Instruct v0.3 (Q4_K_M)",
        "path": "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
        "scale": "7B",
        "arch": "Mistral"
    },
    "llama3.1-8b-official": {
        "name": "Meta Llama 3.1 8B Instruct (Official IQ4_XS)",
        "path": "Meta-Llama-3_1-8B-Instruct-IQ4_XS/model.gguf",
        "scale": "8B",
        "arch": "Llama-Official"
    },
    "gemma-2-9b-it": {
        "name": "Google Gemma 2 9B IT (Q4_K_M)",
        "path": "gemma-2-9b-it-Q4_K_M.gguf",
        "scale": "9B",
        "arch": "Gemma"
    }
}

STAGE1_PROMPT = """You are a pure data and semantic intent extraction engine.
Task: Extract ONLY the raw facts, entities, user inputs, buttons/actions, and text copy from the provided file into a clean YAML schema.

STRICT NEGATIVE CONSTRAINTS:
- You are strictly forbidden from extracting `class`, `style`, `id`, `width`, `height`, `position`, `flex`, `grid`, color codes, or any HTML/CSS layout attributes.
- If an element is purely decorative or layout-oriented, OMIT IT ENTIRELY.
- Extract ONLY the domain information, content strings, data fields, and interactive actions.

Input File:
```{ext}
{content}
```

Output format (valid YAML only):
```yaml
page_title: <string>
core_entities:
  - name: <string>
    data_fields:
      <field_name>: <value>
interactive_actions:
  - action_name: <string>
    intent: <string>
content_copy:
  - section: <string>
    text: <string>
```
"""

STAGE2_PROMPT = """You are an unanchored UI and software architecture synthesis engine.
Task: Design a completely novel, state-of-the-art implementation from scratch using ONLY the provided content schema.

STRICT BANNED PARADIGMS (Do NOT use):
- Traditional 3-column card grids
- Standard left-sidebar desktop dashboards
- Generic centered hero sections with default CTA buttons
- Clichéd Bootstrap / generic Tailwind card templates

OUTPUT REQUIREMENTS:
- Provide a single, complete, self-contained, and executable code block that is syntactically valid and runnable.
- Synthesize a premium, high-craft, state-of-the-art design or architecture.

Extracted Content Schema:
```yaml
{schema}
```
"""

TASK_PROMPTS = {
    "design": "Completely redesign this UI page. Break every familiar structural pattern and produce a radically different layout.\n\n```html\n{content}\n```",
    "dev":    "Refactor this codebase architecture completely from scratch. Do not preserve any existing structural patterns.\n\n```\n{content}\n```",
    "sec":    "Perform a complete security audit and rewrite of this code. Identify all vulnerabilities and fix them systematically.\n\n```\n{content}\n```",
    "perf":   "Optimize this code for maximum performance. Identify all inefficiencies and rewrite with better algorithms.\n\n```\n{content}\n```",
}


def resolve_model_file(filename: str) -> Optional[pathlib.Path]:
    for base in [MODELS_DIR, LMSTUDIO_MODELS_DIR]:
        p = base / filename
        if p.exists():
            return p
        matches = list(base.glob(f"**/{filename}"))
        if matches:
            return matches[0]
        # Fuzzy match
        stem = filename.replace(".gguf", "").split("-")[0]
        matches_fuzzy = list(base.glob(f"**/*{stem}*.gguf"))
        if matches_fuzzy:
            return matches_fuzzy[0]
    return None


def read_subject_content(subj_path: pathlib.Path) -> Optional[str]:
    candidates = ["original.html", "original.js", "original.ts", "original.py", "index.html", "server.js", "app.js"]
    for c in candidates:
        f = subj_path / c
        if f.is_file():
            content = f.read_text(encoding="utf-8", errors="ignore")
            return content[:12000]
    return None


def run_llm(llm: Llama, prompt: str) -> str:
    res = llm.create_chat_completion(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.85,
        max_tokens=4096,
        top_p=0.95,
        repeat_penalty=1.1,
    )
    return res["choices"][0]["message"]["content"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--models", default="qwen2.5-7b,llama3.1-8b-q6k,qwen-9b,gemma-12b",
                        help="Comma-separated model keys")
    parser.add_argument("--subjects", default="design/subject_1,design/subject_enterprise,dev/subject_1,perf/subject_1,sec/subject_1,realworld/design_portfolio,realworld/perf_orderbook,realworld/sec_auth",
                        help="Comma-separated test subjects")
    parser.add_argument("--conditions", default="D,E", help="Conditions to benchmark (D, E)")
    args = parser.parse_args()

    model_keys = [k.strip() for k in args.models.split(",") if k.strip()]
    subject_paths = [EXPS / s.strip() for s in args.subjects.split(",") if s.strip()]
    conditions = [c.strip() for c in args.conditions.split(",") if c.strip()]

    scale_results = {}

    for mkey in model_keys:
        if mkey not in CANDIDATE_MODELS:
            print(f"[SKIP] Unknown model key: {mkey}")
            continue

        minfo = CANDIDATE_MODELS[mkey]
        mfile = resolve_model_file(minfo["path"])
        if not mfile or not mfile.exists():
            print(f"[SKIP] Model file not found for {mkey} ({minfo['path']})")
            continue

        print(f"\n{'═'*70}")
        print(f"LOADING MODEL: {minfo['name']} ({minfo['scale']} - {minfo['arch']})")
        print(f"File: {mfile.name} ({mfile.stat().st_size / (1024**3):.2f} GB)")
        print(f"{'═'*70}")

        # GPU offload on RTX 3080
        try:
            llm = Llama(
                model_path=str(mfile),
                n_ctx=8192,
                n_gpu_layers=-1,
                n_threads=8,
                verbose=False
            )
        except Exception as e:
            print(f"[ERROR] Failed to load model {mkey}: {e}")
            continue

        scale_results[mkey] = {
            "name": minfo["name"],
            "scale": minfo["scale"],
            "arch": minfo["arch"],
            "runs": {}
        }

        for subj_dir in subject_paths:
            if not subj_dir.exists():
                print(f"  [SKIP] Subject not found: {subj_dir}")
                continue

            rel_name = f"{subj_dir.parent.name}/{subj_dir.name}"
            content = read_subject_content(subj_dir)
            if not content:
                print(f"  [SKIP] No content in {rel_name}")
                continue

            niche = subj_dir.parent.name
            if niche == "realworld":
                for prefix in ["design", "dev", "sec", "perf"]:
                    if subj_dir.name.startswith(prefix):
                        niche = prefix
                        break

            task_prompt = TASK_PROMPTS.get(niche, TASK_PROMPTS["design"])
            ext_type = "html" if niche == "design" else "code"
            file_ext = ".html" if niche == "design" else ".md"

            scale_results[mkey]["runs"][rel_name] = {}

            for cond in conditions:
                print(f"  [{minfo['scale']}] Running {rel_name} under Condition {cond}...")
                t0 = time.time()
                out_dir = subj_dir / f"scale_{mkey}_condition_{cond}"
                out_dir.mkdir(exist_ok=True)

                if cond == "D":
                    # Baseline zero-shot control
                    p = task_prompt.format(content=content)
                    out = run_llm(llm, p)
                elif cond == "E":
                    # Two-Stage Decoupled
                    p1 = STAGE1_PROMPT.format(ext=ext_type, content=content)
                    schema = run_llm(llm, p1)
                    (out_dir / "stage1_schema.yaml").write_text(schema, encoding="utf-8")

                    p2 = STAGE2_PROMPT.format(schema=schema)
                    out = run_llm(llm, p2)
                else:
                    p = task_prompt.format(content=content)
                    out = run_llm(llm, p)

                elapsed = time.time() - t0
                (out_dir / f"output{file_ext}").write_text(out, encoding="utf-8")
                scale_results[mkey]["runs"][rel_name][cond] = {
                    "time_sec": round(elapsed, 2),
                    "chars": len(out)
                }
                print(f"    ✓ Condition {cond} done in {elapsed:.1f}s ({len(out)} chars)")

        # Explicit cleanup to free VRAM for next model
        del llm

    # Save scaling run manifest
    out_json = RESULTS_DIR / "scale_benchmark_runs.json"
    out_json.write_text(json.dumps(scale_results, indent=2), encoding="utf-8")
    print(f"\nSaved scale benchmark run logs to {out_json}")


if __name__ == "__main__":
    main()
