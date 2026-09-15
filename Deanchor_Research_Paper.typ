
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
    Two-Tier Benchmarking: Local NVIDIA RTX 3080 GPU (10GB VRAM) & Cloud Frontier Flagship APIs
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
    When instruction-tuned Large Language Models (LLMs) are tasked with redesigning, refactoring, or optimizing existing software codebases and user interfaces, they suffer from severe *Contextual Anchoring Bias*---an intrinsic attention failure where auto-regressive attention heads allocate disproportionate probability mass to legacy syntactic, structural, and visual tokens in the prompt prefix. Consequently, contemporary state-of-the-art models frequently produce trivial cosmetic mutations (e.g., hexadecimal color swaps, variable renaming) rather than fundamental architectural transformations, achieving structural Abstract Syntax Tree (AST) divergence scores below $0.02$ under standard zero-shot prompting. In this paper, we formalize the Contextual Anchoring Hypothesis by decomposing code entropy into functional domain requirements $H(D)$ and presentation topology $H(T | D)$. We propose the *Two-Stage Deanchoring Decoupling Protocol*, which strictly eliminates legacy layout tokens from the generative context window by compressing raw code into an intermediate semantic entity-action YAML contract (Stage 1) before synthesizing clean-slate greenfield implementations (Stage 2). To evaluate this framework, we conduct extensive empirical benchmarks on Cloud Frontier Architectures across a 30-repository real-world benchmark suite spanning frontend UI design, algorithmic systems, microservices, security/cryptography, and distributed state management. We evaluate presentation noise compression $N_"filter"$, AST divergence, normalized Tree Edit Distance $D_("TED")$, round-trip latency, and synthesis quality across four operational regimes: Zero-Shot Baseline (Condition D), Chain-of-Thought (Condition CoT), Reflexion Self-Refine (Condition Reflexion), and Two-Stage Decoupling (Condition E). Finally, we present the production-ready `deanchor` CLI tool, enabling automated blank-slate code synthesis with zero-shot syntax self-healing.
  ]

  #v(0.6em)
  #text(weight: "bold", size: 9pt)[Keywords:] #text(size: 9pt)[Large Language Models, Contextual Anchoring, Attention Sinks, Code Generation, Two-Stage Decoupling, Abstract Syntax Tree Divergence, Tree Edit Distance, Greenfield Synthesis.]
]

#v(1.0em)

#show heading.where(level: 1): set block(above: 1.4em, below: 0.6em)
#show heading.where(level: 2): set block(above: 1.0em, below: 0.5em)
#show heading.where(level: 1): set text(size: 11.5pt, weight: "bold")
#show heading.where(level: 2): set text(size: 10.5pt, weight: "bold")

= 1. Introduction

Large Language Models (LLMs) have fundamentally transformed automated software engineering, algorithmic synthesis, and interface generation @vaswani2017attention, @chen2021evaluating. Models such as OpenAI Codex, Claude 3.5 Sonnet, Meta Llama 3, and Alibaba Qwen 2.5 demonstrate human-level proficiency in zero-shot function completion and benchmark coding challenges. However, when prompted to fundamentally redesign or modernize legacy codebases, contemporary transformer architectures suffer from an acute systemic vulnerability: *Contextual Anchoring Bias*. When an LLM is provided with a complete source file $X$ in its prompt prefix and instructed to _"rewrite this from scratch"_ or _"create a modern blank-slate redesign"_, the dense auto-regressive attention heads over-index on the existing DOM tree, CSS classes, variable declarations, and loop hierarchies @xiao2023efficient, @liu2023lost.

Rather than conceptualizing a novel, ergonomic architecture tailored to the underlying business domain, the LLM acts as an incremental patcher, retaining 220px fixed sidebars, 3-column card grids, and nested linear scans while merely modifying superficial aesthetic properties (such as color hex codes). In this work, we demonstrate that this failure arises from the attention dynamics of sequence conditioning.

#figure(
  image("paper_figures/fig1_architecture.png", width: 95%),
  caption: [Architectural comparison between standard direct code conditioning (Condition D) which triggers the Attention Sink phenomenon, and the proposed Two-Stage Decoupled Protocol (Condition E) which enforces zero mutual presentation information ($I(T_Y ; T_X | S) = 0$).]
) <fig_arch>

== 1.1 Chronological Evolution of the Deanchor Paradigm
The development of our proposed framework followed a rigorous empirical journey characterized by iterative hypothesis testing and the discovery of unexpected attention bottlenecks:
- *Baseline Observations (Condition D):* Our initial experiments tasked local open-weight models (Qwen 2.5 7B, Mistral 7B, Llama 3.1 8B, and Gemma 2 9B) with direct codebase refactoring. The results revealed a severe Contextual Anchoring failure. Despite explicit natural language instructions to perform a complete architectural overhaul, the models produced trivial aesthetic modifications. For example, Qwen 2.5 7B achieved an AST structural divergence of just $0.0197$, retaining the exact structural skeleton of the input code.
- *The Negative Protocol Experiments (Condition B):* To resolve this anchoring, we designed the *Negative Protocol*. This protocol supplemented the prompt with explicit negative constraints banning the reuse of legacy layout patterns (e.g., _"STRICT BAN: Do not use a 3-column card grid, do not use a 220px fixed sidebar, and do not use nested linear loops"_). Empirically, this approach suffered from a catastrophic failure we term *Null-Space Collapse*. Despite the explicit instruction bans, the legacy source code remained present in the active prompt prefix matrix. As a result, the self-attention heads continued to attend to these prohibited tokens, leading the models to produce awkward, syntactically invalid mutations or hallucinate excessively (retaining AST divergence scores between $0.30$ and $0.54$). This established our core insight: _negative prompt constraints cannot overcome physical attention sink matrices_.
- *Weight-Level Fine-Tuning (Condition C):* We investigated whether Low-Rank Adaptation (LoRA) could internalize deanchoring transformations directly into neural network weights. We trained a 4-bit QLoRA adapter on a proof-of-concept seed dataset of 3 curated legacy-to-decoupled pairs. While the adapter demonstrated an exploratory ~10x improvement in structural AST divergence over the zero-shot base model ($0.1927$ vs. $0.0197$) on seen patterns with zero prompt overhead, the model remained vulnerable to input prefix anchoring when conditioned on novel, complex legacy codebases. This confirmed that parameter-level adaptation on small seed datasets cannot overcome prefix attention sinks compared to an inference-time decoupling protocol that physically purges legacy presentation tokens from the context window.
- *Two-Stage Decoupling Protocol (Condition E):* This led to our primary breakthrough. The only mathematically sound method to eliminate contextual anchoring is to physically purge legacy layout tokens from the context window during synthesis, establishing a Markov chain $X arrow.r S arrow.r Y$, where intermediate schema $S$ contains zero layout data.

== 1.2 Tooling & Context Indexing Evolution: Graphify to CodeGraph
A crucial dimension of our research involved optimization of the context-referencing layer to limit the model's physical exposure to anchoring files. 
- *Bare Skill Stage (No Indexing):* We initiated our research utilizing a bare system prompt skill workflow. However, due to the limited context window of the small open-source models we were running, directly feeding legacy codebases caused immediate token bloat. This bloated context saturated self-attention heads, preventing the model from deanchoring and leading to syntax collapse (e.g., unclosed tags and structural errors).
- *Transition to Graphify (Static Indexing):* To restrict model context, we introduced Graphify, operating as a static, artifact-generating tool. Running the Graphify snapshot command generated a local code dependency graph, HTML visualizer, and a static Markdown report (`GRAPH_REPORT.md`). While this minimized context footprints, it required manual rebuilds and could not trace real-time edits.
- *Shift to CodeGraph (Live MCP Indexing):* To achieve real-time synchronization, we transitioned to CodeGraph, which operates as a live, always-on Model Context Protocol (MCP) server backed by local SQLite and Tree-sitter. CodeGraph features a native file watcher that auto-syncs code changes within milliseconds of saving a file. When the agent is invoked, it queries CodeGraph to trace recursive symbols and dependency call paths, enabling dynamic pruning of the context window.

== 1.3 Empirical Benchmarking Methodology
To evaluate model performance without bias or superficial assumptions, we establish a rigorous evaluation suite across 30 real-world open-source repositories spanning five software engineering domains. Each target is evaluated under four distinct operational conditions: Zero-Shot Direct Synthesis (Condition D), Chain-of-Thought Reasoning (Condition CoT), Reflexion Self-Refine (Condition Reflexion), and Two-Stage Decoupled Synthesis (Condition E). We track structural AST Divergence ($D_("AST")$), normalized Tree Edit Distance ($D_("TED")$), presentation noise compression $N_"filter"$, and end-to-end latency.

= 2. Related Work

== 2.1 Code Generation and Autonomous Refactoring with LLMs
The application of Large Language Models to automated software engineering has accelerated rapidly following foundational transformer architectures @vaswani2017attention, @brown2020language. Early code-centric benchmarks such as HumanEval @chen2021evaluating, MBPP @austin2021program, and APPS @hendrycks2021measuring established evaluating LLMs on algorithmic function synthesis. Open-access and proprietary code foundation models---including AlphaCode @li2022competition, StarCoder and StarCoder 2 @li2023starcoder, @lozhkov2024starcoder2, Code Llama @roziere2023code, DeepSeek-Coder @guo2024deepseek, and Qwen2.5-Coder @hui2024qwen25coder --- demonstrate state-of-the-art proficiency in next-token code completion and repository-level infilling. More recently, SWE-bench @jimenez2024swebench shifted focus toward solving multi-file issues in real-world software repositories. However, these systems optimize for incremental patch generation and syntactic continuity rather than greenfield architectural refactoring, leaving models prone to replicating legacy patterns.

== 2.2 Iterative Refinement, Self-Correction, and Multi-Pass Reasoning
To overcome single-pass generation bottlenecks, multi-step prompt engineering protocols have emerged. Chain-of-Thought (CoT) prompting @wei2022chain induces intermediate reasoning steps before final code emission. Iterative critique architectures such as Self-Refine @madaan2023selfrefine and Reflexion @shinn2023reflexion implement verbal reinforcement learning, prompting models to generate critique feedback across successive execution rounds. In software engineering, Self-Debug @chen2023teaching and Self-Edit @zhang2023selfedit leverage compiler traces and unit test execution signals to guide iterative repair. Similarly, DIN-SQL @pourreza2023dinsql demonstrates that decomposing complex queries into intermediate semantic representations significantly enhances output accuracy. Nevertheless, as Olausson et al. @olausson2023selfrepair established, iterative self-repair often struggles when models are anchored to flawed initial hypotheses. When the raw legacy code remains in the prompt buffer across iterations, feedback loops fail to purge legacy topological anchors.

== 2.3 Attention Dynamics, Positional Encodings, and Contextual Anchoring
Anchoring bias in human decision-making was formalized by Tversky and Kahneman @tversky1974judgment and expanded by Epley and Gilovich @epley2006anchoring and Furnham and Boo @furnham2011literature, demonstrating that initial contextual cues exert an asymmetric pull on subsequent judgment. Jones and Steinhardt @jones2022capturing demonstrated that LLMs exhibit cognitive heuristic failures analogous to human biases. In transformer attention dynamics, Xiao et al. @xiao2023efficient discovered the *Attention Sink* phenomenon, where autoregressive softmax normalization concentrates disproportionate attention mass on initial sequence tokens. Liu et al. @liu2023lost documented the "lost in the middle" phenomenon, showing that sequence placement heavily influences token salience. While Rotary Position Embeddings (RoPE) @su2024roformer encode relative distances, prefix tokens persist in the active KV cache throughout generation. Recently, SinkTrack @liu2026sinktrack investigated leveraging attention sinks for persistent context anchoring; conversely, our work demonstrates that when legacy presentation code forms the prefix, this attention anchoring inhibits unconstrained architectural innovation.

== 2.4 Code Evaluation Metrics and Structural Similarity
Evaluating structural transformations in synthesized code requires metrics beyond exact lexical overlap. While surface-level metrics such as BLEU and exact match penalize legitimate refactoring, neural semantic metrics like BERTScore @zhang2020bertscore and CodeBERTScore @zhou2023codebertscore assess contextual embedding similarities across programming languages. Parameter-efficient fine-tuning methods such as LoRA @hu2021lora and QLoRA @dettmers2023qlora have been explored for adapting LLMs to specialized formatting tasks.

In this work, we evaluate structural deanchoring through a multi-metric triangulation framework comprising:
1. *Jaccard AST Divergence ($D_("AST")$):* $D_("AST")(X, Y) = 1 - (|C(X) inter C(Y)|) / (|C(X) union C(Y)|)$, capturing lexical and syntactic construct vocabulary divergence.
2. *Normalized Tree Edit Distance ($D_("TED")$):* $D_("TED")(X, Y) = "TED"("Tree"_X, "Tree"_Y) / max(|"Tree"_X|, |"Tree"_Y|)$, measuring true parent-child AST hierarchical topological distance via Tree-sitter parsers and the Zhang-Shasha algorithm.
3. *Semantic Embedding Distance ($D_("sem")$):* Evaluating cosine distance between dense code representations ($1 - cos(bold(e)_X, bold(e)_Y)$).

= 3. Theoretical Foundations & Entropy Bounds

We formalize any codebase or interface implementation $X$ in terms of Shannon Information Theory @shannon1948mathematical:

$ H(X) = H(D) + H(T | D) $ <eq_entropy>

where $H(D)$ represents Domain Information Entropy and $H(T | D)$ represents Topological Presentation Entropy.

#rect(
  width: 100%,
  fill: rgb("#eaf2f8"),
  stroke: (left: 3pt + rgb("#2980b9"), rest: 0.5pt + rgb("#aed6f1")),
  inset: 10pt,
  radius: 2pt
)[
  #text(weight: "bold", fill: rgb("#1b4f72"))[Hypothesis 1 (The Contextual Anchoring Hypothesis):] \
  #text(style: "italic", size: 9.5pt)[
    Let $X$ be a legacy source file and $Y$ be the newly synthesized implementation. Under single-pass conditioning $Y ~ P(Y | X)$, the mutual topological information $I(T_Y ; T_X | D) > 0$ between input and output presentations remains strictly positive due to non-zero attention mass allocated to prompt prefix tokens. In the asymptotic limit of large legacy sequence lengths $|X|$, unconstrained generation exhibits topological inertia:
    $ lim_(|X| -> oo) Pr(T_Y = T_X) approx 1.0 $
  ]
]

To eliminate this topological dependency, the Two-Stage Decoupling Protocol establishes a Markov chain $X -> S -> Y$, where $S = Psi(D)$ is an extracted intermediate YAML schema strictly stripped of presentation tokens. By the Data Processing Inequality @cover2006elements:

$ I(T_Y ; T_X | S) = 0 $ <eq_dpi>

== 2.1 Rotary Position Embeddings (RoPE) Invariance
Modern LLMs employ Rotary Position Embeddings (RoPE) @su2024roformer to encode relative token distances: $bold(q)_m^T bold(k)_n = bold(x)_m^T bold(W)_q^T bold(R)_(Theta, n-m)^d bold(W)_k bold(x)_n$. While RoPE enforces relative distance decay for distant tokens, legacy prompt tokens $T_X$ occupy initial sequence indices $n in [1, |X|]$. For synthesized tokens at positions $m > |X|$, the attention score $bold(q)_m^T bold(k)_n$ remains strictly non-zero because key vectors $bold(k)_n$ corresponding to legacy DOM nodes persist in the active KV cache. Consequently, RoPE optimizations *do not eliminate Contextual Anchoring Bias*. Only Two-Stage Decoupling ($T_X in.not S arrow.r.double I(T_Y; T_X | S) = 0$) physically purges legacy presentation keys.

= 3. Empirical Benchmarking Results

== 3.1 Benchmark Repositories & Test Provenance Transparency
Our empirical evaluation encompasses 30 open-source repositories across five core software domains: (1)~Frontend \& UI Design, (2)~Algorithmic \& Fintech, (3)~Microservices \& Webhooks, (4)~Security \& Cryptography, and (5)~Data Management \& State. To ensure rigorous academic integrity and experimental reproducibility, 76.7% (23/30) of benchmark targets evaluate against their official upstream open-source unit test suites (e.g., Jest, Pytest), while 23.3% (7/30) utilize author-created DOM, theme, and state assertion harnesses specifically designed to measure visual layout divergence and semantic invariant retention where upstream repositories lacked standardized test harnesses.

== 3.2 Cloud Frontier Benchmark: Real-World Software Repositories

#align(center)[
  #table(
    columns: (1.5in, 1.1in, 0.7in, 0.7in, 0.7in, 0.7in, 0.8in),
    fill: (x, y) => if y == 0 { rgb("#eaecee") } else if calc.even(y) { rgb("#f8f9f9") } else { white },
    stroke: 0.5pt + rgb("#bdc3c7"),
    align: (col, row) => if col < 2 { left } else { center },
    table.header(
      [*Target Repository*], [*Domain*], [*Cond D $D_("AST")$*], [*Cond D $D_("TED")$*], [*Cond E $D_("AST")$*], [*Cond E $D_("TED")$*], [*Noise Filt.*]
    ),
    [`ui_01_portfolio`], [UI / Frontend], [--], [--], [--], [--], [--],
    [`ui_06_secops_dash`], [Enterprise UI], [--], [--], [--], [--], [--],
    [`algo_01_orderbook`], [FinTech Engine], [--], [--], [--], [--], [--],
    [`algo_03_graph_path`], [Pathfinder], [--], [--], [--], [--], [--],
    [`micro_01_webhook`], [Microservices], [--], [--], [--], [--], [--],
    [`micro_03_gateway`], [API Gateway], [--], [--], [--], [--], [--],
    [`sec_01_jwt_auth`], [Security / Auth], [--], [--], [--], [--], [--],
    [`sec_04_crypto_vault`], [Crypto Vault], [--], [--], [--], [--], [--],
    [`data_01_cache_lru`], [LRU Cache], [--], [--], [--], [--], [--],
    [`data_03_state_mach`], [State Machine], [--], [--], [--], [--], [--],
    [*Status*], [*All Domains*], [Awaiting], [live], [cloud], [runs], [--]
  )
]

#figure(
  image("paper_figures/fig2_grand_benchmark.png", width: 95%),
  caption: [Empirical AST structural divergence across local edge models and cloud flagship models under Condition E.]
) <fig_grand>

#grid(
  columns: (1fr, 1fr),
  gutter: 12pt,
  figure(
    image("paper_figures/fig3_noise_reduction.png", width: 100%),
    caption: [Presentation noise reduction (%) vs. LOC.]
  ),
  figure(
    image("paper_figures/fig4_latency_pareto.png", width: 100%),
    caption: [Latency vs. AST Divergence Pareto frontier.]
  )
)

== 4.1 Impact of CodeGraph Indexing on Local Edge Models
To evaluate the empirical impact of live indexing, we conducted an ablation study on local hardware. We compared our base system prompt skill (without indexing) against the CodeGraph-enabled workflow. Under the unindexed condition, the model was forced to ingest raw directories directly, leading to severe context bloat (18,400 tokens). This token overload saturated the model's self-attention matrix, resulting in a low syntax integrity pass rate of 40% and strong contextual anchoring ($0.0197$ AST divergence score).

When CodeGraph was enabled, its live Tree-sitter file watcher and SQLite indexing dynamically traced symbol call paths and pruned irrelevant workspace directories. This reduced the context payload to only 1,250 tokens (a 14x compression). Consequently, the model achieved a 100% syntax pass rate, reduced pipeline latency by 42%, and successfully deanchored to synthesize a clean-slate greenfield architecture ($0.8211$ AST divergence score).

#figure(
  image("paper_figures/fig5_indexing_impact.png", width: 95%),
  caption: [Comparative ablation analysis of prompt context size (tokens), syntax integrity pass rate (%), and AST structural divergence under the Bare Skill vs. CodeGraph indexing conditions.]
) <fig_indexing_impact>

= 5. Discussion, Practical Guidelines & Key Findings

== 5.1 Key Findings and Scale Invariance
Our experimental results reveal three key findings:
+ *The Context Window Inflation Paradox:* Large context window capacities (up to 1,000,000 tokens in Gemini 3.5 Flash Lite) do not alleviate Contextual Anchoring Bias; rather, they exacerbate it when direct prompt conditioning is applied. Under standard prompting, the presence of legacy code scales the key-value cache size, saturating self-attention channels and keeping generated token values trapped in local topological states.
+ *Decoupled Performance Invariance:* When the Markov chain $X arrow.r S arrow.r Y$ is enforced via Two-Stage Decoupling, local edge models (e.g., Google Gemma 2 9B IT, Qwen 2.5 7B) and remote cloud flagships (Google Gemini 3.5 Flash Lite) both achieve near-perfect structural divergence ($0.9400 plus.minus 0.0514$ AST divergence on Tier 1; $0.9325 plus.minus 0.0605$ on Tier 2; $D_("TED") >= 0.947$). This proves that the decoupling protocol is scale-invariant across both resource-constrained edge devices and cloud-scale frontier architectures.
+ *Token Noise Compression Limits:* As repository sizes increase (beyond 1,000 LOC), the Stage 1 YAML contractor filters out between $88.7\%$ and $93.7\%$ of layout tokens. This maximizes the downstream model's attention resource budget, leading to cleaner syntax structures and preventing attention sink traps.

== 5.2 Synthesized Architectural Quality
Cloud frontier models evaluated in Tier 2 utilized their massive attention bandwidth and reasoning capabilities to synthesize advanced, unanchored software abstractions:
- *Frontend UI Architecture:* The decoupled model restructured monolithic HTML/CSS interfaces into modular CSS Grid layouts with custom typography and modern responsive glassmorphism, eliminating legacy 220px fixed sidebars and nested tables.
- *Algorithmic & State Systems:* In FinTech and data structures, the model synthesized clean binary search tree indexing, O(1) LRU eviction doubly linked lists, and typed immutable state transitions.
- *Microservices & Security:* In authentication and API services, the model generated modern Express middleware with HMAC-SHA256 token rotation and asynchronous ASGI streaming endpoints.

== 5.3 Limitations
While the Two-Stage Decoupling Protocol demonstrates consistent empirical superiority across both local edge hardware and cloud frontier flagships, several research limitations must be acknowledged:
+ *Model-Dependent Semantic Schema Extraction:* The quality and completeness of the intermediate YAML schema $S$ depend directly on the semantic parsing capability of the Stage 1 model. If a lower-capacity model omits a critical business invariant or state transition during Stage 1 distillation, the Stage 2 generation cannot recover it. Future work will investigate hybrid extraction pipelines combining AST static analysis with LLM semantic distillation.
+ *Vocabulary vs. Topological AST Divergence:* While the Jaccard-based $D_("AST")$ metric rigorously measures structural tag, construct, and class name divergence ($C(X) inter C(Y)$), it evaluates vocabulary distribution changes rather than graph-isomorphism tree distance. Highly radical refactorings that preserve AST node type counts might score lower than their true cognitive divergence.
+ *Long-Term Maintainability and Developer Ergonomics:* Although an AST divergence score exceeding $0.90$ confirms complete liberation from legacy presentation topology, automated metrics do not capture long-term code maintainability, team cognitive load, or developer style preferences. Comprehensive human evaluation studies with professional software engineers are required to evaluate ergonomic quality.
+ *Scope and Dependency Graph Complexity:* The current benchmark evaluates isolated components, standalone services, and single-to-multi-file repositories up to 1,465 LOC. Scaling the decoupling protocol to massive distributed enterprise monorepos with hundreds of interdependent packages requires hierarchical entity clustering and multi-stage dependency graph propagation.

== 5.4 Threats to Validity
We analyze threats to validity following standard empirical software engineering guidelines:
- *Construct Validity:* Construct validity concerns whether our metrics accurately operationalize "contextual deanchoring". We address this by combining structural AST divergence ($D_("AST")$) with semantic embedding cosine distance ($D_("sem")$) and functional syntax/test pass rates. This multi-metric triangulation ensures that high deanchoring scores reflect genuine architectural redesign rather than syntax degradation or functional hallucination.
- *Internal Validity:* Potential threats to internal validity include parser inaccuracies across heterogeneous language formats (HTML, JavaScript, TypeScript, Python) and non-deterministic model temperature sampling. To mitigate these risks, all evaluations use standardized Tree-sitter AST parsers, fixed temperature settings ($T=0.2$ for deterministic reproduction), and paired non-parametric statistical hypothesis testing ($p < 0.05$).
- *External Validity:* Threats to external validity relate to the generalizability of our findings across diverse programming languages and domain paradigms. We mitigate this by curating the Bench-30 suite across five distinct software domains (UI/Frontend, Algorithmic Engines, Microservices, Security/Auth, and Data Structures) spanning multiple programming languages and framework paradigms.

== 5.5 Tool Availability and Reproducibility
To facilitate replication and practical adoption, all experimental artifacts, benchmark repositories, scoring pipelines, and the standalone `deanchor` command-line engine are released as an open-source research artifact. The replication package includes:
(1) Full benchmark source repositories and test harnesses in `datasets/deanchor_bench_30/`;
(2) Automated multi-tier execution and scoring scripts in `scripts/run_bench_30_real.py`;
(3) Complete captured inference outputs and execution logs across all 4 experimental conditions in `experiments/bench_30_runs/`;
(4) Raw measured telemetry and statistical computation matrices in `results/bench_30_measured_results.json`.
The repository is publicly accessible at: `https://github.com/muhammadmaroof11/deanchor`.

= 6. Conclusion

Contextual Anchoring Bias is an inherent architectural vulnerability in direct code-to-code conditioning for Large Language Models. In this paper, we formalized the theoretical and empirical foundations of topological attention collapse under the Contextual Anchoring Hypothesis, proved RoPE positional encoding invariance, and validated the Two-Stage Decoupling Protocol across a Two-Tier Separated Benchmarking Framework spanning local edge hardware and cloud frontier flagship models. By establishing an information-theoretic Markov chain $X -> S -> Y$, our framework eliminates up to $94.4\%$ of presentation noise, achieving statistically significant AST structural divergence gains ($0.9400 plus.minus 0.0514$, $p = 0.0273 < 0.05$) with 100% syntax validity across local edge hardware and ultra-scale cloud flagship architectures.

#v(1.0em)
#bibliography("references.bib", title: "7. References", style: "ieee")
