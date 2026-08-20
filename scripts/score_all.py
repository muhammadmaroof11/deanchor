#!/usr/bin/env python3
"""
score_all.py
────────────
Orchestrator — runs all three scoring methods for all experiments,
then generates all charts.

Usage:
  python scripts/score_all.py
  python scripts/score_all.py --mode design --skip-embedding
  python scripts/score_all.py --charts-only
"""

import subprocess
import sys
import argparse
import pathlib
import time

ROOT    = pathlib.Path(__file__).parent.parent
SCRIPTS = ROOT / "scripts"
PYTHON  = sys.executable


def run(script: str, args: list[str] = []) -> int:
    cmd = [PYTHON, str(SCRIPTS / script)] + args
    print(f"\n{'━'*60}")
    print(f"▶ Running: {script} {' '.join(args)}")
    print(f"{'━'*60}")
    t0 = time.time()
    result = subprocess.run(cmd, cwd=str(ROOT))
    elapsed = time.time() - t0
    status = "✓" if result.returncode == 0 else "✗"
    print(f"{status} {script} completed in {elapsed:.1f}s (exit code {result.returncode})")
    return result.returncode


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode",             default="all")
    parser.add_argument("--skip-structural",  action="store_true")
    parser.add_argument("--skip-embedding",   action="store_true")
    parser.add_argument("--skip-judge",       action="store_true")
    parser.add_argument("--skip-comparator",  action="store_true")
    parser.add_argument("--skip-charts",      action="store_true")
    parser.add_argument("--charts-only",      action="store_true")
    parser.add_argument("--local-embeddings", action="store_true",
                        help="Use local sentence-transformers instead of API")
    args = parser.parse_args()

    print(f"\n{'═'*60}")
    print("DEANCHOR RESEARCH — SCORING PIPELINE")
    print(f"{'═'*60}")

    if args.charts_only:
        run("generate_charts.py")
        return

    mode_args = ["--mode", args.mode] if args.mode != "all" else []
    errors = []

    if not args.skip_structural:
        rc = run("score_structural.py", mode_args)
        if rc != 0: errors.append("score_structural")

    if not args.skip_embedding:
        emb_args = mode_args + (["--local"] if args.local_embeddings else [])
        rc = run("score_embedding.py", emb_args)
        if rc != 0: errors.append("score_embedding")

    if not args.skip_judge:
        rc = run("score_llm_judge.py", mode_args)
        if rc != 0: errors.append("score_llm_judge")
        
    if not args.skip_comparator:
        rc = run("score_llm_comparator.py", mode_args)
        if rc != 0: errors.append("score_llm_comparator")

    if not args.skip_charts:
        rc = run("generate_charts.py")
        if rc != 0: errors.append("generate_charts")

    print(f"\n{'═'*60}")
    if errors:
        print(f"⚠ Pipeline complete with errors in: {', '.join(errors)}")
        print("  Check output above for details.")
    else:
        print("✓ All scoring and chart generation complete!")
    print(f"\nOutputs:")
    print(f"  Scores:  {ROOT / 'results'}/scores_*.json")
    print(f"  Charts:  {ROOT / 'results/charts'}/*.png")
    print(f"{'═'*60}")


if __name__ == "__main__":
    main()
