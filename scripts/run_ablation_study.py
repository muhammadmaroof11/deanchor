#!/usr/bin/env python3
"""
Ablation Study Experiment Runner for Deanchor Research.

Academic Integrity Notice (.agents/rules/research-integrity.md):
Legacy versions of this script contained hardcoded constant dictionaries.
Ablation data must be derived exclusively from real model inference runs
across the 6 conditioning paradigms (C_D, C_Trunc, C_Skel, C_Docstring, C_JSON, C_YAML).
"""

import sys
import json
import pathlib

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = pathlib.Path(__file__).resolve().parent.parent
RESULTS_DIR = ROOT / "results"
RESULTS_DIR.mkdir(exist_ok=True)
OUTPUT_JSON = RESULTS_DIR / "ablation_study_results.json"


def main():
    print("=" * 80)
    print("DEANCHOR ABLATION EXPERIMENT RUNNER")
    print("Academic Integrity Rule: Real inference measurements only.")
    print("=" * 80)
    print("\nTo execute empirical ablation sweeps, run:")
    print("  python scripts/run_bench_30_real.py --runs 3")
    print("\nResults will be written to results/bench_30_measured_results.json.")


if __name__ == "__main__":
    main()
