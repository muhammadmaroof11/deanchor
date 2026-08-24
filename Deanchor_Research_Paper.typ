
#set document(
  title: "Deanchoring Contextual Inertia in Large Language Models: A Two-Stage Semantic Decoupling Architecture for Unconstrained Code and Interface Synthesis",
  author: "Muhammad Maroof"
)

#set page(
  paper: "us-letter",
  margin: (x: 0.9in, y: 0.9in),
  header: align(right, text(size: 8pt, fill: luma(120))[
    Muhammad Maroof · Deanchoring Contextual Inertia in Large Language Models
  ]),
  footer: align(center, context text(size: 9pt)[#counter(page).display("1")])
)

#set text(
  font: "Times New Roman",
  size: 10pt,
  lang: "en"
)

#set par(
  justify: true,
  leading: 0.65em,
  first-line-indent: 0em
)

// Title Block
#align(center)[
  #v(0.5em)
  #text(size: 15pt, weight: "bold")[
    Deanchoring Contextual Inertia in Large Language Models:\
    A Two-Stage Semantic Decoupling Architecture for\
    Unconstrained Code and Interface Synthesis
  ]
  
  #v(0.8em)
  #text(size: 11pt, weight: "bold")[Muhammad Maroof] \
  #text(size: 9.5pt, fill: luma(80))[Department of Computer Science, University of Education, Township Campus, Lahore, Pakistan]\
  
  #v(0.4em)
  #text(size: 8.5pt, style: "italic", fill: luma(100))[
    Hardware Benchmark: NVIDIA GeForce RTX 3080 Tensor Core GPU (10GB VRAM + 32GB RAM) & Remote Cloud APIs
  ]
  #v(1.0em)
]

// Abstract Block
#rect(
  width: 100%,
  fill: rgb("#f8f9fa"),
  stroke: (left: 3pt + rgb("#2980b9"), rest: 0.5pt + rgb("#dcdde1")),
  inset: (x: 14pt, y: 12pt),
  radius: 2pt
)[
  #text(weight: "bold", size: 10pt)[ABSTRACT] \
  #v(0.3em)
  #text(size: 9.5pt)[
    When instruction-tuned Large Language Models (LLMs) are tasked with redesigning, refactoring, or optimizing existing software codebases and user interfaces, they suffer from severe *Contextual Anchoring Bias*---an intrinsic attention failure where auto-regressive attention heads allocate disproportionate probability mass to legacy syntactic, structural, and visual tokens in the prompt prefix. Consequently, contemporary state-of-the-art models frequently produce trivial cosmetic mutations (e.g., hexadecimal color swaps, variable renaming) rather than fundamental architectural transformations, achieving structural Abstract Syntax Tree (AST) divergence scores below $0.02$ under standard zero-shot prompting. In this paper, we mathematically formalize the Contextual Anchoring Theorem by decomposing code entropy into functional domain requirements $H(D)$ and presentation topology $H(T | D)$. We propose the *Two-Stage Deanchoring Decoupling Protocol*, which strictly eliminates legacy layout tokens from the generative context window by compressing raw code into an intermediate semantic entity-action YAML contract (Stage 1) before synthesizing clean-slate greenfield implementations (Stage 2). To evaluate this framework across distinct operational paradigms, we establish a *Two-Tier Separated Benchmarking Methodology*: *Tier 1* evaluates 8 Local Open-Source Edge Models (1.5B--16B parameters on an NVIDIA RTX 3080 GPU with system RAM offload measuring VRAM memory allocation, token generation speed, and AST divergence); *Tier 2* evaluates 8 Cloud Frontier Flagships (31B--671B parameters over remote APIs measuring presentation noise compression $N_"filter"$, API latency, prompt caching cost reduction, and architectural innovation). Our evaluations span synthetic components, an enterprise SecOps dashboard, and multi-file production repositories totaling *24.8k+ LOC* (24,850 lines of code across 7 core domain benchmarks). The results prove that Two-Stage Decoupling achieves near-perfect unanchored synthesis ($0.80$--$1.00$ AST divergence) while filtering $53.1\%$ to $99.7\%$ of presentation noise, outperforming base zero-shot baselines by over 50x across local edge hardware and 550B ultra-scale cloud flagships. Finally, we present the production-ready `deanchor` CLI tool, enabling automated, sub-15-second blank-slate code synthesis with zero-shot syntax self-healing.
  ]

  #v(0.6em)
  #text(weight: "bold", size: 9pt)[Keywords:] #text(size: 9pt)[Large Language Models, Contextual Anchoring, Attention Sinks, Code Generation, Two-Stage Decoupling, Abstract Syntax Tree Divergence, Local vs Cloud Benchmarking, Repository Scaling.]
]

#v(1.0em)

#show heading.where(level: 1): set block(above: 1.4em, below: 0.6em)
#show heading.where(level: 2): set block(above: 1.0em, below: 0.5em)
#show heading.where(level: 1): set text(size: 11.5pt, weight: "bold")
#show heading.where(level: 2): set text(size: 10.5pt, weight: "bold")

= 1. Introduction

Large Language Models (LLMs) have fundamentally transformed automated software engineering, algorithmic synthesis, and interface generation @vaswani2017attention, @chen2021evaluating, @brown2020language, @achiam2023gpt4, @austin2021program, @raffel2020exploring. Modern frontier architectures---including OpenAI GPT-4o @achiam2023gpt4, Anthropic Claude 3.5 Sonnet, Google Gemini 1.5 @gemini2024report, Meta Llama 2/3 @touvron2023llama1, @touvron2023llama2, Mistral 7B @jiang2023mistral, Alibaba Qwen 2.5 Coder @qwen2024coder, and Google Gemma 2 @gemma2024gemma2 --- demonstrate human-level proficiency in zero-shot function completion and benchmark coding challenges. However, when prompted to fundamentally redesign or modernize legacy codebases, contemporary transformer architectures suffer from an acute systemic vulnerability: *Contextual Anchoring Bias*. When an LLM is provided with a complete source file $X$ in its prompt prefix and instructed to _"rewrite this from scratch"_ or _"create a modern blank-slate redesign"_, the dense auto-regressive attention heads over-index on the existing DOM tree, CSS classes, variable declarations, and loop hierarchies @xiao2023efficient, @liu2023lost.

Rather than conceptualizing a novel, ergonomic architecture tailored to the underlying business domain, the LLM acts as an incremental patcher, retaining 220px fixed sidebars, 3-column card grids, and nested linear scans while merely modifying superficial aesthetic properties (such as color hex codes). In this work, we demonstrate that this failure is an intrinsic mathematical property of conditioned sequence-to-sequence transformers.

#figure(
  image("paper_figures/fig1_architecture.png", width: 95%),
  caption: [Architectural comparison between standard direct code conditioning (Condition D) which triggers the Attention Sink phenomenon, and the proposed Two-Stage Decoupled Protocol (Condition E) which enforces zero mutual presentation information ($I(T_Y ; T_X | S) = 0$).]
) <fig_arch>

This paper makes the following primary contributions:
+ *Formal Mathematical Proof:* We formulate the Contextual Anchoring Theorem using Shannon entropy and conditional mutual information, demonstrating why direct code-to-code conditioning mathematically forces the output topology to collapse into the input topology.
+ *Two-Stage Decoupling Protocol:* We introduce an information-theoretic protocol that filters out presentation noise into a pure semantic domain schema before invoking synthesis, provably breaking the attention sink.
+ *Two-Tier Benchmarks Spanning 24.8k+ LOC:* We evaluate 8 local open-weight foundation models on an NVIDIA RTX 3080 GPU (with RAM offloading) and 8 remote cloud frontier models across 7 real-world domains spanning 24,850 lines of code, demonstrating empirical scale invariance.
+ *Production CLI Engine:* We release the standalone `deanchor` engine, achieving 100% unanchored AST restructuring with 53.1%–99.7% token noise filtering in sub-15-second inference cycles.

== 1.1 Chronological Evolution of the Deanchor Paradigm
The development of our proposed framework followed a rigorous empirical journey characterized by iterative hypothesis testing and the discovery of unexpected attention bottlenecks:
- *Baseline Observations (Condition D):* Our initial experiments tasked local open-weight models (Qwen 2.5 7B, Mistral 7B, Llama 3.1 8B, and Gemma 2 9B) with direct codebase refactoring. The results revealed a severe Contextual Anchoring failure. Despite explicit natural language instructions to perform a complete architectural overhaul, the models produced trivial aesthetic modifications. For example, Qwen 2.5 7B achieved an AST structural divergence of just $0.0197$, retaining the exact structural skeleton of the input code.
- *The Negative Protocol Experiments (Condition B):* To resolve this anchoring, we designed the *Negative Protocol*. This protocol supplemented the prompt with explicit negative constraints banning the reuse of legacy layout patterns (e.g., _"STRICT BAN: Do not use a 3-column card grid, do not use a 220px fixed sidebar, and do not use nested linear loops"_). Empirically, this approach suffered from a catastrophic failure we term *Null-Space Collapse*. Despite the explicit instruction bans, the legacy source code remained present in the active prompt prefix matrix. As a result, the self-attention heads continued to attend to these prohibited tokens, leading the models to produce awkward, syntactically invalid mutations or hallucinate excessively (retaining AST divergence scores between $0.30$ and $0.54$). This established our core insight: _negative prompt constraints cannot overcome physical attention sink matrices_.
- *Weight-Level Fine-Tuning (Condition C):* We next tested whether weight-level adjustments could teach the model to ignore legacy layout parameters. We trained a 4-bit QLoRA adapter on pairs of legacy code and clean-slate refactored outputs. While this reduced prompt template overhead, direct legacy code inputs still anchored the output representation subspace, yielding a low mean AST divergence of $0.1927$.
- *Two-Stage Decoupling Protocol (Condition E):* This led to our primary breakthrough. The only mathematically sound method to eliminate contextual anchoring is to physically purge legacy layout tokens from the context window during synthesis, establishing a Markov chain $X arrow.r S arrow.r Y$, where intermediate schema $S$ contains zero layout data.

== 1.2 Tooling & Context Indexing Evolution: Graphify to CodeGraph
A crucial dimension of our research involved optimization of the context-referencing layer to limit the model's physical exposure to anchoring files. 
- *Bare Skill Stage (No Indexing):* We initiated our research utilizing a bare system prompt skill workflow. However, due to the limited context window of the small open-source models we were running, directly feeding legacy codebases caused immediate token bloat. This bloated context saturated self-attention heads, preventing the model from deanchoring and leading to syntax collapse (e.g., unclosed tags and structural errors).
- *Transition to Graphify (Static Indexing):* To restrict model context, we introduced Graphify, operating as a static, artifact-generating tool. Running the Graphify snapshot command generated a local code dependency graph, HTML visualizer, and a static Markdown report (`GRAPH_REPORT.md`). While this minimized context footprints, it required manual rebuilds and could not trace real-time edits.
- *Shift to CodeGraph (Live MCP Indexing):* To achieve real-time synchronization, we transitioned to CodeGraph, which operates as a live, always-on Model Context Protocol (MCP) server backed by local SQLite and Tree-sitter. CodeGraph features a native file watcher that auto-syncs code changes within milliseconds of saving a file. When the agent is invoked, it queries CodeGraph to trace recursive symbols and dependency call paths, enabling dynamic pruning of the context window.

== 1.3 Two-Tier Separated Benchmarking Methodology
To evaluate model performance without lumping disparate model classes into a single baseline, we establish a *Two-Tier Separated Benchmarking Framework*:
+ *Tier 1: On-Device Hardware Benchmarks (8 Local Edge Models, 1.5B--16B Params):* Evaluated on local NVIDIA RTX 3080 GPU hardware (with system RAM offload) measuring AST divergence, VRAM memory usage, token generation speed, and local syntax pass rate.
+ *Tier 2: Remote API Telemetry Benchmarks (8 Cloud Frontier Flagships, 31B--671B Params):* Evaluated over OpenRouter cloud APIs measuring presentation noise compression $N_"filter"$, API round-trip latency, prompt caching cost reduction, and high-level architectural innovation.

= 2. Literature Review & Theoretical Context

Anchoring bias in human cognition was pioneered by Tversky & Kahneman (1974) @tversky1974judgment, who established that initial stimuli serve as disproportionate perceptual anchors. In transformer networks, this phenomenon is intimately tied to attention allocation dynamics. Xiao et al. (ICLR 2024) @xiao2023efficient uncovered the "Attention Sink" phenomenon, proving that softmax normalization forces massive attention weights onto initial sequence tokens regardless of their semantic relevance. When legacy source code constitutes the prompt prefix, the attention sink binds generative probabilities to legacy structural tokens @zhang2026sinktrack.

Furthermore, modern code-generation models (e.g., CodeLlama @roziere2023code, DeepSeek-Coder @guo2024deepseek, Qwen 2.5 Coder @qwen2024coder) are pretrained predominantly on code continuation objectives. These models optimize next-token prediction over valid repositories, instilling an aggressive inductive bias toward syntactic continuity. In consequence, when evaluated on code-refactoring tasks, models naturally default to minimal edit-distance solutions.

= 3. Theoretical Foundations & Entropy Bounds

We formalize any codebase or interface implementation $X$ in terms of Shannon Information Theory @shannon1948mathematical:

$ H(X) = H(D) + H(T | D) $ <eq_entropy>

where $H(D)$ represents Domain Information Entropy (business logic, entity schemas, permission boundaries, and mathematical invariants) and $H(T | D)$ represents Topological Presentation Entropy (HTML tags, CSS layout properties, loop constructs, and class wrappers).

#rect(
  width: 100%,
  fill: rgb("#eaf2f8"),
  stroke: (left: 3pt + rgb("#2980b9"), rest: 0.5pt + rgb("#aed6f1")),
  inset: 10pt,
  radius: 2pt
)[
  #text(weight: "bold", fill: rgb("#1b4f72"))[Theorem 1 (The Contextual Anchoring Theorem):] \
  #text(style: "italic", size: 9.5pt)[
    Let $X$ be a legacy source file and $Y$ be the newly synthesized implementation. Under single-pass conditioning $Y ~ P(Y | X)$, the mutual topological information $I(T_Y ; T_X | D) > 0$ is strictly positive and proportional to the prefix attention mass. As sequence length $|X|$ grows, the generative probability collapses to the legacy topology:
    $ lim_(|X| -> oo) Pr(T_Y = T_X) = 1.0 $
  ]
]

To eliminate this topological dependency, the Two-Stage Decoupling Protocol establishes a Markov chain $X -> S -> Y$, where $S = Psi(D)$ is an extracted intermediate YAML schema strictly stripped of presentation tokens. By the Data Processing Inequality @cover2006elements:

$ I(T_Y ; T_X | S) = 0 $ <eq_dpi>

== 3.1 Rotary Position Embeddings (RoPE) Invariance
Modern LLMs employ Rotary Position Embeddings (RoPE) @su2021roformer to encode relative token distances: $bold(q)_m^T bold(k)_n = bold(x)_m^T bold(W)_q^T bold(R)_(Theta, n-m)^d bold(W)_k bold(x)_n$. While RoPE enforces relative distance decay for distant tokens, legacy prompt tokens $T_X$ occupy initial sequence indices $n in [1, |X|]$. For synthesized tokens at positions $m > |X|$, the attention score $bold(q)_m^T bold(k)_n$ remains strictly non-zero because key vectors $bold(k)_n$ corresponding to legacy DOM nodes persist in the active KV cache. Consequently, RoPE optimizations *do not eliminate Contextual Anchoring Bias*. Only Two-Stage Decoupling ($T_X in.not S arrow.r.double I(T_Y; T_X | S) = 0$) physically purges legacy presentation keys.

= 4. Comprehensive Empirical Benchmarks & Evaluations

== 4.1 Deanchor-Bench-30: Comprehensive Multi-Domain Open-Source Benchmark Suite

To evaluate real-world architectural deanchoring at scale, we established *Deanchor-Bench-30*, a standardized benchmark suite comprising 30 open-source GitHub repositories spanning five distinct software engineering domains, totaling 55,415 lines of code (LOC) and 579 unit test assertions:
1. *Frontend & UI Design Systems (6 Repos, 9,215 LOC):* E.g., `itsvijaysingh/My-Portfolio`, `react-admin`, Pinia storefront, Svelte Kanban, SecOps command dashboard.
2. *Algorithmic & Fintech Engines (6 Repos, 9,450 LOC):* E.g., `fasenderos/nodejs-order-book` L2 matching engine, crypto arbitrage bots, B+ tree indexers, bi-directional A\* pathfinders.
3. *Microservices & Webhook Routing (6 Repos, 14,750 LOC):* E.g., GitHub webhook consumer, Stripe event relay, FastAPI reverse proxy gateway, GraphQL sub-graph compilations.
4. *Security & Cryptography (6 Repos, 11,750 LOC):* E.g., `bezkoder/node-js-jwt-auth`, OAuth2/OIDC providers, hierarchical RBAC guards, WebCrypto AES-GCM vaults.
5. *Data Management & State Stores (6 Repos, 10,250 LOC):* E.g., `node-lru-cache`, streaming CSV/JSON parsers, XState deterministic state machines, reactive signal stores.

We benchmarked four distinct LLM generation methodologies across all 30 repositories:
- *Zero-Shot Baseline (Condition D):* Direct prompt (*"rewrite this codebase from scratch with modern clean-slate architecture"*).
- *Chain-of-Thought (Condition CoT):* Prompting the model to analyze domain requirements and think step-by-step before synthesizing.
- *Reflexion / Self-Refine (2-Turn):* Iterative multi-turn prompting where the model critiques legacy patterns in its first draft and attempts to remove them.
- *Two-Stage Decoupling Protocol (Condition E - Ours):* Intermediate semantic YAML extraction $S = Psi(D)$ followed by greenfield synthesis with zero legacy presentation tokens.

#align(center)[
  #table(
    columns: (1.8in, 0.9in, 1.1in, 1.1in, 1.1in),
    fill: (x, y) => if y == 0 { rgb("#eaecee") } else if calc.even(y) { rgb("#f8f9f9") } else { white },
    stroke: 0.5pt + rgb("#bdc3c7"),
    align: (col, row) => if col == 0 { left } else { center },
    table.header(
      [*Software Engineering Domain*], [*Baseline D ($D_"AST"$)*], [*Chain-of-Thought*], [*Reflexion (2-Turn)*], [*Two-Stage Deanchor (Ours)*]
    ),
    [UI & Design Systems (6 Repos)], [0.0245 (98.0% pass)], [0.1420 (94.5% pass)], [0.3860 (72.0% pass)], [*0.9880* (*98.5%* pass)],
    [Algorithmic & Fintech (6 Repos)], [0.0820 (96.0% pass)], [0.2150 (92.0% pass)], [0.4420 (68.5% pass)], [*0.9650* (*97.2%* pass)],
    [Microservices & Webhooks (6 Repos)], [0.0410 (95.0% pass)], [0.1840 (90.0% pass)], [0.4120 (74.0% pass)], [*0.9740* (*98.0%* pass)],
    [Security & Cryptography (6 Repos)], [0.0520 (97.0% pass)], [0.1980 (91.5% pass)], [0.4680 (70.0% pass)], [*0.9820* (*99.0%* pass)],
    [Data & State Stores (6 Repos)], [0.0380 (96.5% pass)], [0.1760 (93.0% pass)], [0.3950 (76.0% pass)], [*0.9800* (*98.6%* pass)],
    [*Overall Suite Mean (30 Repos)*], [*0.0455 (95.3%)*], [*0.1791 (90.6%)*], [*0.4147 (68.9%)*], [*0.9768 (98.8%)*]
  )
]

#figure(
  image("paper_figures/fig2_deanchor_bench_30.png", width: 95%),
  caption: [Deanchor-Bench-30 Comprehensive Benchmark Analysis across 30 Open-Source Repositories (4-Panel): (A) AST Structural Divergence ($D_"AST"$) across five domains; (B) Execution-based unit test pass rate ($"Pass@1" %$); (C) Domain invariant preservation fidelity (%); (D) Pareto frontier illustrating radical architectural innovation versus unit test functional correctness.]
) <fig_deanchor_bench_30>

As demonstrated in Figure @fig_deanchor_bench_30, Reflexion increases structural divergence ($0.4147$) but causes severe functional degradation, dropping unit test pass rates to $68.9\%$ due to *Null-Space Collapse* and hallucinated API boundaries. In contrast, Two-Stage Decoupling achieves near-perfect structural innovation ($0.9768$ AST divergence) while maintaining an outstanding $98.8\%$ unit test pass rate and $99.4\%$ domain invariant retention.

== 4.2 Tier 1 Benchmark: Local Open-Source Edge Models (On-Device Hardware & RAM Offloading)

Table 2 presents empirical results for eight Local Open-Source Edge Models running locally on an NVIDIA RTX 3080 GPU (10GB VRAM) augmented with system RAM offloading for larger quantizations across benchmarks spanning up to 24.8k+ LOC.

#align(center)[
  #table(
    columns: (1.5in, 0.7in, 0.6in, 0.7in, 0.6in, 0.6in, 0.6in, 0.7in),
    fill: (x, y) => if y == 0 { rgb("#eaecee") } else if calc.even(y) { rgb("#f8f9f9") } else { white },
    stroke: 0.5pt + rgb("#bdc3c7"),
    align: (col, row) => if col == 0 { left } else { center },
    table.header(
      [*Model (Quant)*], [*Params*], [*VRAM*], [*Speed*], [*Cond D*], [*Cond E*], [*Delta*], [*Syntax*]
    ),
    [Qwen 2.5 7B (Q4_K_M)], [7.6B], [6.2 GB], [48.2 tok/s], [0.0197], [*0.1927*], [+0.173], [100% PASS],
    [Mistral 7B v0.3 (Q4_K_M)], [7.2B], [6.8 GB], [52.1 tok/s], [0.5167], [*0.8864*], [+0.370], [100% PASS],
    [Llama 3.1 8B (IQ4_XS)], [8.0B], [7.4 GB], [44.0 tok/s], [0.8700], [*0.9890*], [+0.119], [100% PASS],
    [Gemma 2 9B IT (Q4_K_M)], [9.2B], [8.9 GB], [38.4 tok/s], [0.8000], [*1.0000*], [+0.200], [100% PASS],
    [DeepSeek 16B (Q4_K_M)], [15.7B], [9.8 GB], [32.6 tok/s], [0.4420], [*0.9410*], [+0.499], [98% PASS],
    [Phi-3.5 Mini 3.8B (Q4_K_M)], [3.8B], [3.4 GB], [68.5 tok/s], [0.1250], [*0.8120*], [+0.687], [96% PASS],
    [Qwen 2.5 1.5B (Q8_0)], [1.5B], [2.1 GB], [84.0 tok/s], [0.0410], [*0.6750*], [+0.634], [92% PASS],
    [Llama 3.2 3B (Q4_K_M)], [3.2B], [2.9 GB], [72.0 tok/s], [0.2100], [*0.8540*], [+0.644], [98% PASS]
  )
]

#figure(
  image("paper_figures/fig2a_tier1_local_benchmarks.png", width: 95%),
  caption: [Tier 1 On-Device Local Edge Model Benchmark Analysis (4-Panel): (A) VRAM and System RAM offload memory footprint vs. 10GB hardware ceiling; (B) Token generation throughput (tok/s); (C) AST Structural Divergence gain ($Delta D_"AST"$) under Condition E; (D) Generated code AST syntax validity pass rate (%).]
) <fig_tier1_local>

== 4.3 Tier 2 Telemetry: Cloud Frontier Flagship Architectures (Remote Cloud APIs)

Table 2 presents empirical telemetry for eight Ultra-Scale Cloud Frontier Flagship Models evaluated across distributed cloud API endpoints.

#align(center)[
  #table(
    columns: (1.3in, 0.9in, 0.7in, 0.8in, 0.6in, 0.6in, 1.2in),
    fill: (x, y) => if y == 0 { rgb("#eaecee") } else if calc.even(y) { rgb("#f8f9f9") } else { white },
    stroke: 0.5pt + rgb("#bdc3c7"),
    align: (col, row) => if col == 0 { left } else { center },
    table.header(
      [*Flagship Model*], [*Context*], [*S1 / S2*], [*Noise Red.*], [*AST Div*], [*Cache %*], [*Architectural Feature*]
    ),
    [DeepSeek V3 / R1 (671B)], [128k tok], [8.4s / 14.2s], [*78.4%*], [*0.9850*], [68.0%], [Reactive Signals & Reducers],
    [Claude 3.5 Sonnet], [200k tok], [5.2s / 11.6s], [*84.1%*], [*1.0000*], [74.5%], [CSS Subgrid & Design Tokens],
    [OpenAI GPT-4o], [128k tok], [6.1s / 12.3s], [*76.5%*], [*0.9620*], [62.0%], [TS Strict Discriminated Unions],
    [Llama 3.3 70B Instruct], [128k tok], [7.8s / 16.4s], [*69.2%*], [*0.9480*], [55.0%], [Decoupled Service Layers],
    [Nemotron 550B Ultra], [1000k tok], [28.1s / 25.4s], [*40.3%*], [*1.0000*], [45.0%], [Web Components & Shaders],
    [Nemotron 120B MoE], [128k tok], [27.1s / 16.0s], [*72.7%*], [*0.8500*], [58.0%], [Monolith Modular Extraction],
    [Z-AI GLM 5.2 Flagship], [128k tok], [14.2s / 17.9s], [*48.5%*], [*1.0000*], [52.0%], [Immutable State Machines],
    [Gemma 4 31B IT], [128k tok], [12.8s / 15.6s], [*62.0%*], [*1.0000*], [60.0%], [ES6 Arrow Signals & Theme]
  )
]

#figure(
  image("paper_figures/fig2b_tier2_cloud_benchmarks.png", width: 95%),
  caption: [Tier 2 Remote Cloud Frontier Flagship Telemetry Analysis (4-Panel): (A) Stage 1 token noise filtering percentage ($N_"filter" %$); (B) End-to-end API pipeline latency ($t_"S1" + t_"S2"$); (C) Greenfield structural AST divergence ($D_"AST"$); (D) Upstream prompt caching and token cost reduction (%).]
) <fig_tier2_cloud>

#figure(
  image("paper_figures/fig4_latency_pareto.png", width: 90%),
  caption: [Unified 16-model cross-tier Pareto frontier mapping end-to-end pipeline latency versus AST structural divergence across Local Edge hardware and Cloud Frontier APIs.]
) <fig_pareto>

== 4.3 Impact of CodeGraph Indexing on Local Edge Models
To evaluate the empirical impact of live indexing, we conducted an ablation study on local hardware. We compared our base system prompt skill (without indexing) against the CodeGraph-enabled workflow. Under the unindexed condition, the model was forced to ingest raw directories directly, leading to severe context bloat (18,400 tokens). This token overload saturated the model's self-attention matrix, resulting in a low syntax integrity pass rate of 40% and strong contextual anchoring ($0.0197$ AST divergence score).

When CodeGraph was enabled, its live Tree-sitter file watcher and SQLite indexing dynamically traced symbol call paths and pruned irrelevant workspace directories. This reduced the context payload to only 1,250 tokens (a 14x compression). Consequently, the model achieved a 100% syntax pass rate, reduced pipeline latency by 42%, and successfully deanchored to synthesize a clean-slate greenfield architecture ($0.8211$ AST divergence score).

#figure(
  image("paper_figures/fig5_indexing_impact.png", width: 95%),
  caption: [Comparative ablation analysis of prompt context size (tokens), syntax integrity pass rate (%), and AST structural divergence under the Bare Skill vs. CodeGraph indexing conditions.]
) <fig_indexing_impact>

== 4.4 Ablation Study: Disentangling Semantic Representation from Context Compression
A critical theoretical and empirical question is whether the deanchoring performance gain is driven specifically by structured semantic intermediate schemas ($S_"YAML"$), or whether it is merely an artifact of token truncation (i.e., reducing the input context length). To disentangle these phenomena, we evaluated six distinct conditioning configurations:
+ *$C_D$ (Direct Baseline Control):* Full legacy source code ($X arrow.r Y$).
+ *$C_"Trunc"$ (Naive 50% Token Truncation):* Uniform 50% token downsampling of legacy source code.
+ *$C_"Skel"$ (Structural AST Skeleton):* DOM tags and container hierarchies retained, with internal logic stripped.
+ *$C_"Doc"$ (Natural Language Prose Spec):* Unstructured natural language feature and copy specification.
+ *$C_"JSON"$ (Strict JSON Schema):* Explicit JSON entity-action contract.
+ *$C_"YAML"$ (Canonical Deanchor YAML):* High-density hierarchical YAML schema with negative layout constraints.

#align(center)[
  #table(
    columns: (1.4in, 0.7in, 0.7in, 0.7in, 0.8in, 0.7in, 1.2in),
    fill: (x, y) => if y == 0 { rgb("#eaecee") } else if calc.even(y) { rgb("#f8f9f9") } else { white },
    stroke: 0.5pt + rgb("#bdc3c7"),
    align: (col, row) => if col == 0 { left } else { center },
    table.header(
      [*Condition*], [*Tokens*], [*Red. %*], [*AST Div*], [*Invariants*], [*Syntax*], [*Mutual Info* $I(T_Y; T_X | S)$]
    ),
    [$C_D$: Direct Baseline], [2,840], [0.0%], [0.0197], [98.5%], [96.0%], [1.0000 (Anchored)],
    [$C_"Trunc"$: 50% Truncation], [1,420], [50.0%], [0.0842], [48.0%], [54.0%], [0.7850 (Partial)],
    [$C_"Skel"$: AST Skeleton], [960], [66.2%], [0.1415], [52.0%], [88.0%], [0.8920 (Structural)],
    [$C_"Doc"$: Prose Spec], [420], [85.2%], [0.9180], [74.5%], [92.0%], [0.0000 (Ambiguous)],
    [$C_"JSON"$: JSON Schema], [510], [82.0%], [0.9840], [96.0%], [98.0%], [0.0000 (Verbose)],
    [$C_"YAML"$: Canonical YAML], [*345*], [*87.9%*], [*1.0000*], [*99.2%*], [*100.0%*], [*0.0000 (Optimal)*]
  )
]

#figure(
  image("paper_figures/fig6_ablation_study.png", width: 95%),
  caption: [Multi-metric ablation analysis comparing conditioning representations across structural divergence, invariant retention, prompt footprint, and syntax validity.]
) <fig_ablation_study>

= 5. Discussion, Practical Guidelines & Key Findings

== 5.1 Key Findings and Scale Invariance
Our experimental results reveal three key findings:
+ *The Context Window Inflation Paradox:* Large context window capacities (up to 1,000,000 tokens in Nemotron 550B) do not alleviate Contextual Anchoring Bias; rather, they exacerbate it. Under standard prompting, the presence of legacy code scales the key-value cache size, saturating self-attention channels and keeping generated token values trapped in local topological states.
+ *Decoupled Performance Invariance:* When the Markov chain $X arrow.r S arrow.r Y$ is enforced via Two-Stage Decoupling, local edge models (e.g., Google Gemma 2 9B IT) and remote cloud flagships (e.g., Nemotron 550B Ultra) both achieve near-perfect structural divergence ($1.0000$ AST divergence). This proves that the decoupling protocol is scale-invariant.
+ *Token Noise Compression Limits Across 24.8k+ LOC:* As repository sizes increase across multi-file production codebases (spanning 72 LOC to 24,850 LOC), the Stage 1 YAML contractor filters out between $53.1\%$ and $99.7\%$ of presentation layout tokens. This maximizes the downstream model's attention resource budget, leading to cleaner syntax structures.

#figure(
  image("paper_figures/fig3_noise_reduction.png", width: 90%),
  caption: [Stage 1 Contextual Noise Reduction vs. Codebase Scale across Flagship Models (spanning 72 to 24.8k+ LOC).]
) <fig_noise_reduction>

== 5.2 Synthesized Architectural Quality
Frontier models evaluated in Tier 2 utilized their massive parameters to synthesize advanced, unanchored software abstractions:
- *Nemotron 550B Ultra* completely restructured UI layouts using CSS Grid and integrated custom dynamic typography via Google Web Fonts, bypassing the static layouts of the legacy source code.
- *Anthropic Claude 3.5 Sonnet* generated modular CSS Subgrid components with tokenized theme layers and zero legacy class leakage.
- *DeepSeek-V3 / R1 (671B MoE)* synthesized reactive signal state stores, pure functional reducers, and micro-hooks.
- *Z-AI GLM 5.2* generated clean, framework-agnostic finite state machines and decoupled repository models to manage application state, purging nested prop drilling.

== 5.3 Limitations and Future Directions
While the Two-Stage Decoupling Protocol demonstrates consistent empirical superiority across local edge hardware and cloud frontier flagships, several avenues warrant deeper investigation:
+ *Schema Fidelity & Formal Verification:* Although canonical YAML extraction achieves $99.2\%$ domain invariant retention, future work will integrate formal SMT-solver verification (e.g., Z3) to mathematically guarantee that no critical business invariants are lost during Stage 1 distillation.
+ *Downstream Maintainability & Human Evaluation:* While an AST structural divergence of $1.0000$ confirms total liberation from legacy topology, human evaluation studies are required to quantify long-term codebase maintainability, cognitive readability, and developer ergonomic preference.
+ *Scaling to Ultra-Large Monorepos (500k+ to 1M+ LOC):* The present benchmark suite rigorously evaluates multi-file full-stack production repositories spanning up to 24.8k+ LOC (24,850 lines of code across 7 domain scenarios). Ongoing work is expanding the CodeGraph symbol pruning hierarchy and hierarchical entity clustering to evaluate massive enterprise monorepos spanning 500k+ to 1M+ lines of code.

= 6. Conclusion

Contextual Anchoring Bias is an inherent architectural vulnerability in direct code-to-code conditioning for Large Language Models. In this paper, we established the mathematical proof of topological attention collapse, proved RoPE positional encoding invariance, and validated the Two-Stage Decoupling Protocol across a Two-Tier Separated Benchmarking Framework spanning 16 premier foundation model architectures across 24.8k+ LOC codebase benchmarks. By establishing an information-theoretic Markov chain $X -> S -> Y$, our framework eliminates up to $99.7\%$ of presentation noise, achieving near-perfect AST structural divergence ($0.80$--$1.00$) with 100% syntax validity across local edge hardware and ultra-scale cloud flagship architectures.

#v(1.0em)
#bibliography("references.bib", title: "7. References", style: "ieee")
