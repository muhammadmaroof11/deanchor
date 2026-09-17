# Deanchor Project — Actionable Task List

> **Project Goal:** Re-run benchmark experiments with real LLM inference, record empirical results, update LaTeX paper tables and prose, and polish manuscript text for academic publication.

---

## Phase 1: Benchmark Experiment Execution & Data Generation

- [ ] **1.1 Run Benchmark Suite (Tier 1 — Local Edge Models)**
  - Execute `python scripts/run_bench_30_real.py --tier 1 --runs 3` across local models (Qwen 2.5 7B, Mistral 7B, Llama 3.1 8B, Gemma 2 9B).
  - Verify raw outputs are saved in `experiments/bench_30_runs/`.

- [ ] **1.2 Run Benchmark Suite (Tier 2 — Cloud Flagship Models)**
  - Execute `python scripts/run_bench_30_real.py --tier 2 --runs 3` via OpenRouter / Gemini API.
  - Verify raw outputs are recorded.

- [ ] **1.3 Score Empirical Results**
  - Run `python scripts/score_deanchor_bench_30.py` to aggregate empirical metrics.
  - Confirm `results/bench_30_measured_results.json` and `results/deanchor_bench_30_results.json` are generated with real measured values.

---

## Phase 2: Manuscript & Paper Updates (`Deanchor_Research_Paper.tex`)

- [ ] **2.1 Populate Benchmark Results Table (Table I)**
  - Replace `[Awaiting completion of live cloud API benchmark runs]` in `Table I` (`tab:benchmark_cloud`) with measured values ($D_{\text{AST}}$, $D_{\text{TED}}$, $\Delta D_{\text{TED}}$, $N_{\text{filter}}$) across target repositories.

- [ ] **2.2 Update Numerical Claims in LaTeX Prose**
  - Update Section 1.1 (Chronological Evolution) lines 79 & 85 with measured baseline and LoRA scores.
  - Update Section 5.1 (Discussion & Key Findings) lines 276 & 314 with measured mean $D_{\text{AST}}$, $D_{\text{TED}}$, noise filtering percentage, and $p$-value statistics.

- [ ] **2.3 Update Figures & Charts**
  - Run `python scripts/generate_charts.py` and `python scripts/generate_figures.py` using new measured result files to update plots in `paper_figures/`.

---

## Phase 3: Manuscript Writing Polish (`deslop` & `aigc-detector-rewriter`)

- [ ] **3.1 De-slop Abstract & Introduction**
  - Replace generic AI-writing openers (e.g., *"fundamentally transformed automated software engineering"*) with precise academic phrasing.
  - Smooth over-dramatic terminology (e.g., *"acute systemic vulnerability"*, *"catastrophic failure we term Null-Space Collapse"*).

- [ ] **3.2 De-template Enumerated Lists (Section 1.1 & Section 5.1)**
  - Vary sentence length and structure in bullet points to eliminate mechanical, repetitive structural patterns (D12/D13/D15 risk flags).

- [ ] **3.3 Re-compile Paper & PDF Verification**
  - Execute `python scripts/compile_latex_and_pdf.py` to compile `Deanchor_Research_Paper.pdf` and verify zero LaTeX compilation warnings or broken references.
