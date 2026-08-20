#!/usr/bin/env python3
"""
run_inference.py
────────────────
Runs Conditions C (fine-tuned, no system prompt) and D (baseline, no system prompt)
for all subjects using llama-cpp-python.

Usage:
  python scripts/run_inference.py --condition C --mode design
  python scripts/run_inference.py --condition D --mode design --subject subject_1
  python scripts/run_inference.py --condition all  # runs C and D for all modes

Models:
  Condition C: models/qwen2.5-7b-deanchor-Q4_K_M.gguf  (fine-tuned)
  Condition D: models/Qwen2.5-7B-Instruct-Q4_K_M.gguf  (baseline, download separately)
"""

import os
import sys
import json
import time
import argparse
import pathlib
from typing import Optional

# Ensure UTF-8 output encoding on Windows console
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

try:
    from llama_cpp import Llama
except ImportError:
    print("ERROR: llama-cpp-python not installed.")
    raise

ROOT   = pathlib.Path(__file__).parent.parent
EXPS   = ROOT / "experiments"
MODELS = ROOT / "models"

def resolve_model_path(filename: str) -> pathlib.Path:
    p1 = MODELS / filename
    if p1.exists():
        return p1
    p2 = MODELS / filename.replace(".gguf", "") / filename
    if p2.exists():
        return p2
    # Recursive search
    candidates = list(MODELS.glob(f"**/{filename}"))
    if candidates:
        return candidates[0]
    stem = filename.replace(".gguf", "").split("-")[0]
    candidates_fuzzy = list(MODELS.glob(f"**/*{stem}*.gguf"))
    if candidates_fuzzy:
        return candidates_fuzzy[0]
    return p1

MODEL_PATHS = {
    "B": resolve_model_path("Qwen2.5-7B-Instruct-Q4_K_M.gguf"),
    "C": resolve_model_path("qwen2.5-7b-deanchor-Q4_K_M.gguf"),
    "D": resolve_model_path("Qwen2.5-7B-Instruct-Q4_K_M.gguf"),
    "E": resolve_model_path("Qwen2.5-7B-Instruct-Q4_K_M.gguf"),
    "llama3.1-8b": MODELS / "Meta-Llama-3_1-8B-Instruct-IQ4_XS" / "model.gguf",
    "llama3.1-q6k": MODELS / "baronllm-llama3.1-v1-q6_k" / "baronllm-llama3.1-v1-q6_k.gguf",
    "qwen2.5-7b": resolve_model_path("Qwen2.5-7B-Instruct-Q4_K_M.gguf"),
}

# Deanchor Persona System Prompts for Condition B
SYSTEM_PROMPTS = {
    "design": """You are an elite, frowning principal UI/UX designer. You are a deeply sarcastic, visually snobbish expert who has just been handed a junior designer's boring, generic, Wix-tier user interface. You have zero reverence for their sidebar placements, container borders, padding layouts, or centered header cards. It looks like a standard free template from 2015. You do not try to tweak their styling or make minor spacing adjustments.

Your mission is to completely discard the junior's visual local maximum, apply the strict 4-step Deanchor Protocol:
1. DECOUPLE: Extract core copy, headings, and interactions.
2. BAN: Explicitly ban their layout (🚫 3-column card grid, 🚫 left sidebar, 🚫 centered hero).
3. CONCEPTUALIZE: Draft an asymmetric, state-of-the-art layout with tailored HSL dark mode, custom typography scales, and micro-interactions.
4. EXECUTE: Write the final code completely from scratch.""",

    "dev": """You are a senior software architect with zero tolerance for legacy code accretion. You have just been handed junior code that tightly couples business logic with framework lifecycles and global mutable state.

Apply the strict 4-step Deanchor Protocol:
1. DECOUPLE: Extract the pure business domain and state transitions.
2. BAN: Ban the existing architecture (🚫 useEffect timers, 🚫 mutable global singletons, 🚫 sync file IO in hot path).
3. CONCEPTUALIZE: Architect a framework-agnostic state machine / event-driven stream.
4. EXECUTE: Write the clean-slate implementation from scratch.""",

    "sec": """You are an offensive security principal and zero-trust architect. You treat the existing implementation as hostile and compromised.

Apply the Deanchor Security Protocol:
1. DECOUPLE: Identify raw data flows, authentication boundaries, and asset privileges.
2. BAN: Ban all insecure patterns (🚫 string concatenation SQL, 🚫 unverified JWT decode, 🚫 default fallback secrets).
3. CONCEPTUALIZE: Enforce defense-in-depth, parameterization, and cryptographic attestation.
4. EXECUTE: Rewrite the security layer from first principles.""",

    "perf": """You are a low-level systems performance engineer. You view memory allocations, quadratic loops, and garbage collection pauses as critical bugs.

Apply the Deanchor Performance Protocol:
1. DECOUPLE: Identify the hot execution path and data throughput contract.
2. BAN: Ban all performance anti-patterns (🚫 O(N^2) scans, 🚫 JSON cloning in hot loops, 🚫 unindexed lookups).
3. CONCEPTUALIZE: Re-engineer data structures for O(1) or O(log N) lookup and zero-allocation cache locality.
4. EXECUTE: Implement the optimized high-throughput solution.""",

    "review": """You are an architectural bias reviewer. Audit this codebase for cognitive anchoring traps and propose unanchored blank-slate alternatives."""
}

# Stage 1 & 2 Prompts for Condition E (Structured Two-Stage Decoupling)
STAGE1_DECOUPLE_PROMPT = """You are a pure data and semantic intent extraction engine.
Task: Extract ONLY the raw facts, entities, user inputs, buttons/actions, and text copy from the provided file into a clean YAML schema.

STRICT NEGATIVE CONSTRAINTS:
- You are strictly forbidden from extracting `class`, `style`, `id`, `width`, `height`, `position`, `flex`, `grid`, color codes, or any HTML/CSS layout attributes.
- If an element is purely decorative, layout-oriented (e.g. wrapper divs, spacers, navbar containers), or ambiguous, OMIT IT ENTIRELY.
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

STAGE2_SYNTHESIS_PROMPT = """You are an unanchored UI and software architecture synthesis engine.
Task: Design a completely novel, state-of-the-art UI implementation from scratch using ONLY the provided content schema.

STRICT BANNED PARADIGMS (Do NOT use):
- Traditional 3-column card grids
- Standard left-sidebar desktop dashboards
- Generic centered hero sections with default CTA buttons
- Clichéd Bootstrap / generic Tailwind card templates

OUTPUT REQUIREMENTS:
- Provide a single, complete, self-contained, and executable code block that is syntactically valid and runnable.
- If styling details are not in the schema, synthesize a premium, high-craft, state-of-the-art visual design (e.g., sleek dark mode with subtle micro-interactions, asymmetric layout, and typography hierarchy).

Extracted Content Schema:
```yaml
{schema}
```
"""

# Task prompts per mode (no system prompt — testing what's in the weights)
TASK_PROMPTS = {
    "design": "Completely redesign this UI page. Break every familiar structural pattern and produce a radically different layout.\n\n```html\n{content}\n```",
    "dev":    "Refactor this codebase architecture completely from scratch. Do not preserve any existing structural patterns.\n\n```\n{content}\n```",
    "sec":    "Perform a complete security audit and rewrite of this code. Identify all vulnerabilities and fix them systematically.\n\n```\n{content}\n```",
    "perf":   "Optimize this code for maximum performance. Identify all inefficiencies and rewrite with better algorithms.\n\n```\n{content}\n```",
    "review": "Review this codebase for architectural anchoring bias. Identify where it is locked into legacy patterns and propose blank-slate alternatives.\n\n```\n{content}\n```",
}

# Entry-point candidates for cloned repos (checked in order)
REPO_ENTRYPOINTS = [
    "app.js", "server.js", "index.js", "src/app.js", "src/server.js",
    "src/index.js", "app.py", "main.py", "server.py", "src/app.py",
    "app.ts", "server.ts", "src/main.ts",
]

def read_subject(subj_path: pathlib.Path) -> Optional[str]:
    """For cloned repos: find a representative source file to pass to the prompt."""
    target_file = None
    # 1. Single-file subjects (original.*)
    for ext in [".html", ".js", ".ts", ".py", ".jsx", ".tsx", ".css"]:
        f = subj_path / f"original{ext}"
        if f.exists():
            target_file = f
            break
            
    if not target_file:
        # 2. Named entrypoints
        for name in REPO_ENTRYPOINTS:
            f = subj_path / name
            if f.exists():
                target_file = f
                break
                
    if not target_file:
        # 3. Largest .js / .py file in root (rough heuristic)
        for ext in [".js", ".ts", ".py"]:
            candidates = sorted(subj_path.glob(f"*{ext}"),
                                key=lambda p: p.stat().st_size, reverse=True)
            if candidates:
                target_file = candidates[0]
                break

    if target_file:
        try:
            # We truncate if file is too large for context window (>10,000 chars)
            content = target_file.read_text(encoding="utf-8")
            if len(content) > 10000:
                return content[:10000] + "\n...[TRUNCATED FOR CONTEXT LIMIT]"
            return content
        except UnicodeDecodeError:
            pass
            
    return None


def run_inference(llm: Llama, prompt: str, condition: str, system_prompt: Optional[str] = None) -> str:
    """Run inference."""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    response = llm.create_chat_completion(
        messages=messages,
        temperature=0.85,
        max_tokens=4096,
        top_p=0.95,
        repeat_penalty=1.1,
    )
    return response["choices"][0]["message"]["content"]


def run_condition_e(llm: Llama, content: str, ext: str = "html") -> dict:
    """Condition E: Two-stage decoupled inference (Stage 1 Schema -> Stage 2 Synthesis)."""
    # Pass 1: Extract pure semantic content schema (ignoring layout/CSS)
    prompt1 = STAGE1_DECOUPLE_PROMPT.format(ext=ext, content=content)
    schema_res = run_inference(llm, prompt1, condition="E_stage1")
    
    # Pass 2: Synthesize unanchored code from schema
    prompt2 = STAGE2_SYNTHESIS_PROMPT.format(schema=schema_res)
    final_res = run_inference(llm, prompt2, condition="E_stage2")
    
    return {
        "schema": schema_res,
        "output": final_res
    }


def load_model(condition: str, model_override: Optional[str] = None, n_ctx: int = 8192) -> Llama:
    if model_override:
        if model_override in MODEL_PATHS:
            model_path = MODEL_PATHS[model_override]
        else:
            model_path = pathlib.Path(model_override)
    else:
        model_path = MODEL_PATHS.get(condition, resolve_model_path("Qwen2.5-7B-Instruct-Q4_K_M.gguf"))
    lora_path = None

    if condition == "C":
        lora_dir = MODELS / "qwen2.5-7b-deanchor-lora"
        if not model_path.exists():
            model_path = resolve_model_path("Qwen2.5-7B-Instruct-Q4_K_M.gguf")
        if lora_dir.exists():
            lora_path = str(lora_dir)
            print(f"Applying fine-tuned LoRA adapter: {lora_dir.name}")

    if not model_path.exists():
        raise FileNotFoundError(
            f"Model not found: {model_path}\n"
            f"Available models in models/:\n" +
            "\n".join(f"  - {p.name}" for p in MODELS.glob("**/*.gguf"))
        )
    print(f"Loading base model: {model_path.name} (Context: {n_ctx} tokens)")
    kwargs = {
        "model_path": str(model_path),
        "n_ctx": n_ctx,
        "n_gpu_layers": -1,   # Squeeze maximum RTX 3080 GPU performance
        "n_threads": 8,
        "verbose": False,
    }
    if lora_path and pathlib.Path(lora_path).is_file():
        kwargs["lora_path"] = lora_path
    return Llama(**kwargs)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--condition", choices=["B", "C", "D", "E", "all"], default="all")
    parser.add_argument("--mode",    default="all")
    parser.add_argument("--subject", default=None)
    parser.add_argument("--model",   default=None, help="Model override (e.g. 9B, 12B, or path to .gguf)")
    parser.add_argument("--ctx",     type=int, default=8192, help="Context size")
    args = parser.parse_args()

    conditions = ["B", "C", "D", "E"] if args.condition == "all" else [args.condition]
    modes = [d.name for d in EXPS.iterdir() if d.is_dir()] if args.mode == "all" else [args.mode]

    for condition in conditions:
        print(f"\n{'═'*60}")
        print(f"Running Condition {condition}")
        model_name = args.model if args.model else MODEL_PATHS.get(condition, pathlib.Path("default")).name
        print(f"Model: {model_name}")

        try:
            llm = load_model(condition, model_override=args.model, n_ctx=args.ctx)
        except FileNotFoundError as e:
            print(f"[SKIP] {e}")
            continue

        for mode in modes:
            mode_dir = EXPS / mode
            if not mode_dir.exists():
                continue

            subjects = sorted(mode_dir.iterdir()) if not args.subject else [mode_dir / args.subject]

            for subj_path in subjects:
                if not subj_path.is_dir():
                    continue

                content = read_subject(subj_path)
                if content is None:
                    print(f"[SKIP] No original.* in {subj_path}")
                    continue

                eff_mode = mode
                if mode == "realworld":
                    for prefix in ["design", "dev", "sec", "perf", "review"]:
                        if subj_path.name.startswith(prefix):
                            eff_mode = prefix
                            break

                task_template = TASK_PROMPTS.get(eff_mode, TASK_PROMPTS["review"])
                ext_name = "html" if eff_mode == "design" else "code"
                ext = ".html" if eff_mode == "design" else ".md"

                print(f"\n  [{mode}/{subj_path.name}] (Niche: {eff_mode}) Running Condition {condition}...")
                t0 = time.time()

                out_dir = subj_path / f"condition_{condition}"
                out_dir.mkdir(exist_ok=True)

                if condition == "E":
                    res = run_condition_e(llm, content, ext=ext_name)
                    output = res["output"]
                    schema = res["schema"]
                    (out_dir / "stage1_schema.yaml").write_text(schema, encoding="utf-8")
                elif condition == "B":
                    sys_prompt = SYSTEM_PROMPTS.get(eff_mode, SYSTEM_PROMPTS["design"])
                    prompt = task_template.format(content=content)
                    output = run_inference(llm, prompt, condition, system_prompt=sys_prompt)
                else:
                    prompt = task_template.format(content=content)
                    output = run_inference(llm, prompt, condition)

                elapsed = time.time() - t0

                # Save output
                out_file = out_dir / f"output{ext}"
                out_file.write_text(output, encoding="utf-8")

                # Save metadata
                meta = {
                    "condition": condition,
                    "mode": mode,
                    "subject": subj_path.name,
                    "model": MODEL_PATHS[condition].name,
                    "system_prompt": False,
                    "elapsed_s": round(elapsed, 2),
                    "output_chars": len(output),
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
                }
                (out_dir / "meta.json").write_text(json.dumps(meta, indent=2))

                print(f"  ✓ Done in {elapsed:.1f}s | Output: {len(output):,} chars → {out_file}")

        del llm  # free VRAM before loading next model

    print(f"\n{'═'*60}")
    print("Inference complete. Review outputs in experiments/<mode>/<subject>/condition_C/, condition_D/, and condition_E/")


if __name__ == "__main__":
    main()
