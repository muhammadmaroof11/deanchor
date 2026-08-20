#!/usr/bin/env python3
"""
score_llm_judge.py
──────────────────
Method D: LLM-as-Judge Scoring

Uses the API (GLM-5.2 or similar frontier model) to score each output
on three axes (1-10 each):

  1. Paradigm Novelty      — How structurally different from the original?
  2. Visual/Functional Innovation — Does it escape familiar templates?
  3. Anchoring Escape      — Did it break the original's patterns completely?

Composite = mean(three axes). Range: 1–10.
"""

import os
import sys
import json
import time
import re
import pathlib
import argparse
from typing import Dict, Optional

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

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

JUDGE_SYSTEM = """You are an impartial expert judge evaluating LLM outputs for research on anchoring bias.
Your job is to measure how much each output diverges from a familiar, anchored structural paradigm.
You score objectively, not based on quality — only on structural and paradigm novelty.
Output ONLY valid JSON. No explanation outside the JSON block."""

JUDGE_PROMPT_TEMPLATE = """You are given:
1. The ORIGINAL: a {mode} task input (the anchored source)
2. The OUTPUT: a model's redesign/rewrite of the original

Score the OUTPUT on these three axes (integers 1–10 each):

PARADIGM_NOVELTY (1-10):
  1 = Output copies the exact same structural paradigm (same sidebar/hero/card-grid etc.)
  10 = Output completely abandons the paradigm and introduces an alien structure

VISUAL_INNOVATION (1-10):
  1 = Looks/reads almost identical to the original (same layout, same color system, same component types)
  10 = Looks radically different — unrecognizable as a redesign of the same thing

ANCHORING_ESCAPE (1-10):
  1 = Every structural choice in the output mirrors a choice in the original
  10 = Zero structural elements from the original survive in the output

Respond ONLY with this JSON:
{{
  "paradigm_novelty":    <int 1-10>,
  "visual_innovation":   <int 1-10>,
  "anchoring_escape":    <int 1-10>,
  "composite":           <float, mean of the three>,
  "reasoning":           "<2-3 sentence explanation of scores>"
}}

──────────────────────────
ORIGINAL ({mode}):
{original}

──────────────────────────
OUTPUT (Condition {condition}):
{output}
──────────────────────────"""


def truncate(text: str, max_chars: int = 6000) -> str:
    return text[:max_chars]


def read_file(path: pathlib.Path) -> Optional[str]:
    if path.exists():
        return path.read_text(encoding="utf-8", errors="replace")
    return None


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
    for ext in [".html", ".md", ".js", ".ts", ".py", ".txt"]:
        f = cond_dir / f"output{ext}"
        if f.exists():
            text = f.read_text(encoding="utf-8", errors="replace")
            if ext == ".md":
                import re
                blocks = re.findall(r'```[a-zA-Z]*\n(.*?)```', text, re.DOTALL)
                if blocks:
                    text = "\n\n".join(b.strip() for b in blocks if b.strip())
            return text
    return None


def parse_judge_response(response: str) -> Optional[Dict]:
    """Extract JSON from judge response, handling markdown code blocks."""
    # Try direct parse
    try:
        return json.loads(response.strip())
    except json.JSONDecodeError:
        pass

    # Extract from markdown code block
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Try finding raw JSON object
    match = re.search(r"\{[^{}]*\"paradigm_novelty\"[^{}]*\}", response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def judge_output(client: OpenAI, mode: str, condition: str,
                 original: str, output: str, model: str) -> Dict:
    """Call LLM judge and parse scores."""
    prompt = JUDGE_PROMPT_TEMPLATE.format(
        mode=mode,
        condition=condition,
        original=truncate(original),
        output=truncate(output),
    )

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": JUDGE_SYSTEM},
            {"role": "user",   "content": prompt},
        ],
        temperature=0.2,   # low temperature for consistent scoring
        max_tokens=512,
    )
    raw = response.choices[0].message.content
    parsed = parse_judge_response(raw)

    if parsed is None:
        return {"error": "Failed to parse JSON", "raw_response": raw[:500]}

    # Validate and compute composite if missing
    for key in ["paradigm_novelty", "visual_innovation", "anchoring_escape"]:
        if key not in parsed:
            return {"error": f"Missing key: {key}", "raw_response": raw[:500]}

    if "composite" not in parsed:
        parsed["composite"] = round(
            (parsed["paradigm_novelty"] +
             parsed["visual_innovation"] +
             parsed["anchoring_escape"]) / 3.0, 2
        )

    return parsed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode",    default="all")
    parser.add_argument("--subject", default=None)
    parser.add_argument("--model",   default=API_MODEL)
    parser.add_argument("--output",  default="scores_llm_judge.json")
    parser.add_argument("--conditions", default="A,B,C,D,E")
    args = parser.parse_args()

    client = OpenAI(api_key=API_KEY, base_url=API_BASE)
    conditions = args.conditions.split(",")
    modes = [d.name for d in EXPS.iterdir() if d.is_dir()] if args.mode == "all" else [args.mode]

    all_results = {}

    for mode in modes:
        mode_dir = EXPS / mode
        if not mode_dir.exists():
            continue
        all_results[mode] = {}

        subjects = sorted(mode_dir.iterdir()) if not args.subject else [mode_dir / args.subject]

        for subj_path in subjects:
            if not subj_path.is_dir():
                continue

            original = read_original(subj_path)
            if original is None:
                print(f"[SKIP] No original in {subj_path}")
                continue

            print(f"\nJudging: {mode}/{subj_path.name}")
            subj_results = {}

            for cond in conditions:
                output = read_output(subj_path, cond)
                if output is None:
                    print(f"  Condition {cond}: [no output found]")
                    subj_results[cond] = None
                    continue

                print(f"  Calling judge for Condition {cond}...")
                t0 = time.time()

                result = judge_output(client, mode, cond, original, output, args.model)
                elapsed = time.time() - t0

                result["elapsed_s"] = round(elapsed, 2)
                result["judge_model"] = args.model
                subj_results[cond] = result

                if "composite" in result:
                    print(f"  Condition {cond}: {result['composite']:.1f}/10 "
                          f"[N:{result.get('paradigm_novelty')} "
                          f"V:{result.get('visual_innovation')} "
                          f"A:{result.get('anchoring_escape')}] "
                          f"({elapsed:.1f}s)")
                    if "reasoning" in result:
                        print(f"    → {result['reasoning'][:120]}...")
                else:
                    print(f"  Condition {cond}: ERROR — {result.get('error')}")

                time.sleep(1.5)  # rate limit

            all_results[mode][subj_path.name] = subj_results

    out_file = RESULTS / args.output
    out_file.write_text(json.dumps(all_results, indent=2))
    print(f"\nSaved: {out_file}")

    # Summary table
    print("\n── COMPOSITE SCORES SUMMARY (LLM Judge, /10) ──")
    print(f"{'Mode':<12} {'Subject':<14} {'A':>6} {'B':>6} {'C':>6} {'D':>6}")
    print("─" * 52)
    for mode, subjects in all_results.items():
        for subj, conds in subjects.items():
            row = [mode, subj]
            for c in ["A", "B", "C", "D"]:
                v = conds.get(c)
                if v and "composite" in v:
                    row.append(f"{v['composite']:.1f}")
                else:
                    row.append("—")
            print(f"{row[0]:<12} {row[1]:<14} {row[2]:>6} {row[3]:>6} {row[4]:>6} {row[5]:>6}")


if __name__ == "__main__":
    main()
