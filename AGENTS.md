# Deanchor Project — Agent Rules

> **READ FIRST:** This is a scientific research project preparing for peer-reviewed publication.
> Academic integrity rules are strictly enforced.

## Mandatory Pre-Read

Before doing ANY work on this project, read these files in order:

1. **`.agents/rules/research-integrity.md`** — Non-negotiable integrity rules. Covers what data is real vs fabricated, what agents are forbidden from doing, and how to handle results.
2. **`direction.md`** — Active research roadmap with prioritized tasks and checkboxes.
3. **`DEANCHOR.md`** — Cognitive ledger with project history and context.

## Core Constraint

**Do not invent, fabricate, project, or estimate experimental results and write them into data files or the paper.** Only MEASURED values (from actual model inference with actual generated code on disk) may appear in `results/*.json` or `Deanchor_Research_Paper.tex` tables.

The file `scripts/score_deanchor_bench_30.py` is a known fabrication engine (hardcoded seed values + hash-based fake variance). It must be rewritten before use. See `direction.md` P0-2 for the plan.

## Research State Summary

- **What's real:** 5 subjects × 4 local models with actual inference outputs in `experiments/live_runs/`, scored by `score_structural.py` and `score_embedding.py`. Cloud runs via OpenRouter are real.
- **What's fabricated:** `deanchor_bench_30_results.json` (all 30×4 condition results generated from hardcoded constants). The paper tables currently contain these fabricated numbers.
- **What needs doing:** See `direction.md` for the full prioritized action plan.

## Task Protocol

For any task involving more than 3 files:
1. Outline sub-steps first
2. Flag any step that touches `results/` or paper tables as `[CAUTION]`
3. Get user approval before executing dangerous steps
