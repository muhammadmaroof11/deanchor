#!/usr/bin/env python3
"""
Expanded Two-Tier Empirical Benchmark Suite for Deanchor Research.

Academic Integrity Notice (.agents/rules/research-integrity.md):
Legacy versions of this script contained hardcoded telemetry dictionaries.
Tier 1 and Tier 2 benchmarks must be derived exclusively from real model inference runs
(via local LM Studio / Ollama for Tier 1 and OpenRouter API for Tier 2).
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


def main():
    print("=" * 88)
    print("DEANCHOR TWO-TIER BENCHMARK RUNNER (TIER 1 LOCAL & TIER 2 CLOUD)")
    print("Academic Integrity Rule: Real inference measurements only.")
    print("=" * 88)
    print("\nTo execute empirical Tier 1 benchmarks (Local Edge Models):")
    print("  python scripts/run_bench_30_real.py --tier 1 --runs 3")
    print("\nTo execute empirical Tier 2 benchmarks (Cloud Frontier Models):")
    print("  python scripts/run_bench_30_real.py --tier 2 --runs 3")
    print("\nResults will be written to results/bench_30_measured_results.json.")


if __name__ == "__main__":
    main()
