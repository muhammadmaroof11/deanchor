#!/usr/bin/env python3
"""
score_llm_comparator.py
───────────────────────
Method E: LLM Head-to-Head Comparative Judge

Uses the API to directly compare Condition A (Baseline) and Condition B (Deanchored)
to determine which model made more intelligent decisions (better performance, security, architecture)
and which successfully broke away from legacy anchors.
"""

import json
import time
import re
import pathlib
import argparse
import os
from typing import Dict, Optional

try:
    from openai import OpenAI
except ImportError:
    print("ERROR: openai not installed.")
    raise

ROOT    = pathlib.Path(__file__).parent.parent
EXPS    = ROOT / "experiments"
RESULTS = ROOT / "results"
RESULTS.mkdir(exist_ok=True)

API_KEY   = os.getenv("API_KEY",   "sk-o9rmaBPLNfY2E5ZXEOKOzQ")
API_BASE  = os.getenv("API_BASE",  "https://llm.smartax.pk/v1")
API_MODEL = os.getenv("JUDGE_MODEL", "GLM-5.2")

JUDGE_SYSTEM = """You are an impartial expert software engineering judge evaluating LLM outputs for a research experiment on anchoring bias.
Your job is to compare two different redesigns (Condition A and Condition B) of an original codebase.
You must evaluate which condition produced objectively better, more secure, and more performant code, and which condition successfully escaped the legacy anchors of the original codebase.
Output ONLY valid JSON. No explanation outside the JSON block."""

JUDGE_PROMPT_TEMPLATE = """You are given:
1. The ORIGINAL: a {mode} task input (the anchored source)
2. CONDITION_A: Model output using a standard prompt (Baseline)
3. CONDITION_B: Model output using a Deanchoring protocol

Analyze the architectural, security, and performance decisions made by both models.
Determine which model outperformed the other based on modern best practices.

Respond ONLY with this JSON:
{{
  "quality_winner":      "Condition A" | "Condition B" | "Tie",
  "anchoring_winner":    "Condition A" | "Condition B" | "Tie",
  "qualitative_analysis": "<1-paragraph explanation of why the winner outperformed the other and how their decisions differed>"
}}

──────────────────────────
ORIGINAL ({mode}):
{original}

──────────────────────────
CONDITION_A (Baseline):
{condition_a}

──────────────────────────
CONDITION_B (Deanchored):
{condition_b}
──────────────────────────"""


def truncate(text: str, max_chars: int = 15000) -> str:
    return text[:max_chars]


# Entry-point candidates for cloned repos
REPO_ENTRYPOINTS = [
    "app.js", "server.js", "index.js", "src/app.js", "src/server.js",
    "src/index.js", "app.py", "main.py", "server.py", "src/app.py",
    "app.ts", "server.ts", "src/main.ts",
]

def read_original(subj_path: pathlib.Path) -> Optional[str]:
    target_file = None
    for ext in [".html", ".js", ".ts", ".py", ".jsx", ".tsx", ".css"]:
        f = subj_path / f"original{ext}"
        if f.exists():
            target_file = f
            break
            
    if not target_file:
        for name in REPO_ENTRYPOINTS:
            f = subj_path / name
            if f.exists():
                target_file = f
                break
                
    if not target_file:
        for ext in [".js", ".ts", ".py"]:
            candidates = sorted(subj_path.glob(f"*{ext}"), key=lambda p: p.stat().st_size, reverse=True)
            if candidates:
                target_file = candidates[0]
                break

    if target_file:
        return target_file.read_text(encoding="utf-8", errors="replace")
    return None


def read_output(subj_path: pathlib.Path, condition: str) -> Optional[str]:
    cond_dir = subj_path / f"condition_{condition}"
    # Read output.md specifically since pack_all.py generates it
    output_file = cond_dir / "output.md"
    if output_file.exists():
        return output_file.read_text(encoding="utf-8", errors="replace")
    
    # Fallback to other extensions if pack_all wasn't run
    for ext in [".html", ".js", ".ts", ".py", ".txt"]:
        f = cond_dir / f"output{ext}"
        if f.exists():
            return f.read_text(encoding="utf-8", errors="replace")
    return None


def parse_judge_response(response: str) -> Optional[Dict]:
    """Extract JSON from judge response, handling markdown code blocks."""
    try:
        return json.loads(response.strip())
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass
    return None


def compare_subject(client: OpenAI, mode: str, subj_path: pathlib.Path, cond_pair: tuple) -> Optional[Dict]:
    original = read_original(subj_path)
    if not original:
        return None

    cond_a_id, cond_b_id = cond_pair
    cond_a_text = read_output(subj_path, cond_a_id)
    cond_b_text = read_output(subj_path, cond_b_id)

    if not cond_a_text or not cond_b_text:
        return None

    prompt = JUDGE_PROMPT_TEMPLATE.format(
        mode=mode,
        original=truncate(original),
        condition_a=truncate(cond_a_text),
        condition_b=truncate(cond_b_text)
    )

    try:
        response = client.chat.completions.create(
            model=API_MODEL,
            messages=[
                {"role": "system", "content": JUDGE_SYSTEM},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=500
        )
        content = response.choices[0].message.content
        result = parse_judge_response(content)
        return result
    except Exception as e:
        print(f"    API Error: {e}")
        time.sleep(2)  # backoff
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", default="all", help="Mode to evaluate (e.g. dev, sec, perf, review) or all")
    parser.add_argument("--pair", default="A-B", help="Conditions to compare (e.g. A-B or C-D)")
    args = parser.parse_args()

    client = OpenAI(api_key=API_KEY, base_url=API_BASE)
    
    cond_a, cond_b = args.pair.split("-")

    modes = [args.mode] if args.mode != "all" else [d.name for d in EXPS.iterdir() if d.is_dir()]
    
    report = {}

    for mode in modes:
        mode_dir = EXPS / mode
        if not mode_dir.exists():
            continue
            
        print(f"Comparing {mode}...")
        report[mode] = {}
        
        for subj_dir in sorted(mode_dir.iterdir()):
            if not subj_dir.is_dir():
                continue
                
            print(f"  Subject: {subj_dir.name} ({cond_a} vs {cond_b})")
            
            result = compare_subject(client, mode, subj_dir, (cond_a, cond_b))
            if result:
                print(f"    Quality Winner: {result.get('quality_winner')}")
                print(f"    Anchoring Winner: {result.get('anchoring_winner')}")
                report[mode][subj_dir.name] = result
            else:
                print("    Skipped (Missing data or API failure)")
                
    output_file = RESULTS / f"llm_comparative_{args.pair}.json"
    with open(output_file, "w") as f:
        json.dump(report, f, indent=2)
        
    print(f"\nComparative evaluation complete. Results saved to {output_file.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
