#!/usr/bin/env python3
"""
Publication-Grade Figure Generator for Deanchor Research Paper.
Generates high-resolution 300 DPI academic charts and diagrams using Matplotlib.
Includes separate, dedicated multi-panel figures for Tier 1 (Local Edge Models) and Tier 2 (Cloud Frontier Models).
"""

import matplotlib.pyplot as plt
import numpy as np
import pathlib

# Set publication style
plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
plt.rcParams['font.family'] = 'serif'
plt.rcParams['font.serif'] = ['Times New Roman', 'DejaVu Serif', 'Liberation Serif']
plt.rcParams['font.size'] = 9.5
plt.rcParams['axes.titlesize'] = 10.5
plt.rcParams['axes.labelsize'] = 9.5
plt.rcParams['xtick.labelsize'] = 8.5
plt.rcParams['ytick.labelsize'] = 8.5
plt.rcParams['legend.fontsize'] = 8.5
plt.rcParams['figure.titlesize'] = 12

FIGURES_DIR = pathlib.Path(__file__).resolve().parent.parent / "paper_figures"
FIGURES_DIR.mkdir(exist_ok=True)


def generate_figure1_architecture():
    """Figure 1: Architectural Workflow Diagram (Direct Attention Sink vs. Two-Stage Decoupling)."""
    fig, ax = plt.subplots(figsize=(8.0, 3.8), dpi=300)
    ax.axis('off')

    # Direct Baseline (Top)
    ax.text(0.02, 0.82, "A. Standard Direct Conditioning (Condition D — Baseline Attention Sink):", fontweight='bold', fontsize=9.5)
    
    bbox_gray = dict(boxstyle="round,pad=0.4", fc="#EAEDED", ec="#7F8C8D", lw=1.2)
    bbox_red = dict(boxstyle="round,pad=0.4", fc="#FDEDEC", ec="#E74C3C", lw=1.2)
    bbox_green = dict(boxstyle="round,pad=0.4", fc="#EAFAF1", ec="#2ECC71", lw=1.2)
    bbox_blue = dict(boxstyle="round,pad=0.4", fc="#EBF5FB", ec="#3498DB", lw=1.2)
    bbox_yellow = dict(boxstyle="round,pad=0.4", fc="#FEF9E7", ec="#F1C40F", lw=1.2)

    ax.text(0.12, 0.65, "Raw Legacy Code\n(DOM + CSS + Logic)\n[H(D) + H(T|D)]", bbox=bbox_gray, ha='center', va='center', fontsize=8.5)
    ax.annotate("", xy=(0.35, 0.65), xytext=(0.24, 0.65), arrowprops=dict(arrowstyle="->", lw=1.5, color="#2C3E50"))
    ax.text(0.48, 0.65, "Single-Pass Prompt\n(Direct LLM Attention)\nAttention Sink onto Legacy Tokens", bbox=bbox_red, ha='center', va='center', fontsize=8.5)
    ax.annotate("", xy=(0.74, 0.65), xytext=(0.61, 0.65), arrowprops=dict(arrowstyle="->", lw=1.5, color="#2C3E50"))
    ax.text(0.86, 0.65, "Anchored Output\n(Trivial CSS/Hex Tweaks)\nAST Divergence: 0.019", bbox=bbox_red, ha='center', va='center', fontsize=8.5)

    # Decoupled Engine (Bottom)
    ax.text(0.02, 0.42, "B. Two-Stage Decoupled Protocol (Condition E — Proposed Deanchor Engine):", fontweight='bold', fontsize=9.5)
    
    ax.text(0.10, 0.18, "Raw Legacy Code\n(DOM + CSS + Logic)", bbox=bbox_gray, ha='center', va='center', fontsize=8.5)
    ax.annotate("", xy=(0.25, 0.18), xytext=(0.19, 0.18), arrowprops=dict(arrowstyle="->", lw=1.5, color="#27AE60"))
    
    ax.text(0.35, 0.18, "Stage 1: Distillation\n(Strip Layout/CSS Tokens)\nExtract Pure Intents", bbox=bbox_blue, ha='center', va='center', fontsize=8.5)
    ax.annotate("", xy=(0.50, 0.18), xytext=(0.44, 0.18), arrowprops=dict(arrowstyle="->", lw=1.5, color="#27AE60"))

    ax.text(0.59, 0.18, "Intermediate Schema\n(YAML Entities & Data)\nI(T_Y; T_X | S) = 0", bbox=bbox_yellow, ha='center', va='center', fontsize=8.5)
    ax.annotate("", xy=(0.73, 0.18), xytext=(0.68, 0.18), arrowprops=dict(arrowstyle="->", lw=1.5, color="#27AE60"))

    ax.text(0.86, 0.18, "Stage 2: Synthesis\n(Clean-Slate Greenfield)\nAST Divergence: 1.000", bbox=bbox_green, ha='center', va='center', fontsize=8.5)

    plt.tight_layout()
    p = FIGURES_DIR / "fig1_architecture.png"
    plt.savefig(p, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated {p}")


def generate_figure2a_tier1_local():
    """Figure 2A: 4-Panel Benchmark Analysis for Tier 1 Local Edge Models (On-Device Hardware & RAM Offloading)."""
    models = [
        'Qwen 2.5 7B',
        'Mistral 7B',
        'Llama 3.1 8B',
        'Gemma 2 9B',
        'DeepSeek 16B',
        'Phi-3.5 3.8B',
        'Qwen 1.5B',
        'Llama 3.2 3B'
    ]
    
    vram = [6.2, 6.8, 7.4, 8.9, 9.8, 3.4, 2.1, 2.9]
    ram_off = [0.0, 0.0, 0.0, 1.2, 4.5, 0.0, 0.0, 0.0]
    speed = [48.2, 52.1, 44.0, 38.4, 32.6, 68.5, 84.0, 72.0]
    ast_delta = [0.1730, 0.3697, 0.1190, 0.2000, 0.4990, 0.6870, 0.6340, 0.6440]
    syntax_pass = [100.0, 100.0, 100.0, 100.0, 98.0, 96.0, 92.0, 98.0]

    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(11.5, 7.0), dpi=300)
    x = np.arange(len(models))
    width = 0.55

    # Subplot 1: Memory Footprint (VRAM + RAM Offloading)
    ax1.bar(x, vram, width, label='GPU VRAM Allocation (GB)', color='#2980B9', edgecolor='black', lw=0.8)
    ax1.bar(x, ram_off, width, bottom=vram, label='System RAM Offload (GB)', color='#BDC3C7', edgecolor='black', lw=0.8)
    ax1.set_ylabel('Memory Footprint (GB)', fontweight='bold')
    ax1.set_title('A. On-Device Memory Footprint (VRAM vs. System RAM)', fontweight='bold', pad=8)
    ax1.set_xticks(x)
    ax1.set_xticklabels(models, rotation=30, ha='right')
    ax1.axhline(10.0, color='#C0392B', linestyle='--', label='10GB VRAM Hardware Limit', lw=1.2)
    ax1.set_ylim(0, 16.0)
    ax1.grid(True, ls="--", alpha=0.5, axis='y')
    ax1.legend(loc='upper right', frameon=True, fontsize=8.0)

    # Subplot 2: Inference Generation Speed
    ax2.bar(x, speed, width, color='#27AE60', edgecolor='black', lw=0.8)
    ax2.set_ylabel('Generation Speed (Tokens/Second)', fontweight='bold')
    ax2.set_title('B. Local Token Generation Throughput (tok/s)', fontweight='bold', pad=8)
    ax2.set_xticks(x)
    ax2.set_xticklabels(models, rotation=30, ha='right')
    ax2.set_ylim(0, 95.0)
    ax2.grid(True, ls="--", alpha=0.5, axis='y')

    # Subplot 3: AST Divergence Delta
    ax3.bar(x, [d * 100 for d in ast_delta], width, color='#E67E22', edgecolor='black', lw=0.8)
    ax3.set_ylabel('AST Divergence Gain (Delta %)', fontweight='bold')
    ax3.set_title('C. Structural Radicalism Gain (Cond E vs Cond D)', fontweight='bold', pad=8)
    ax3.set_xticks(x)
    ax3.set_xticklabels(models, rotation=30, ha='right')
    ax3.set_ylim(0, 80.0)
    ax3.grid(True, ls="--", alpha=0.5, axis='y')

    # Subplot 4: Syntax Integrity Pass Rate
    ax4.bar(x, syntax_pass, width, color='#8E44AD', edgecolor='black', lw=0.8)
    ax4.set_ylabel('Syntax Integrity Pass Rate (%)', fontweight='bold')
    ax4.set_title('D. Generated Code AST Syntax Validity (%)', fontweight='bold', pad=8)
    ax4.set_xticks(x)
    ax4.set_xticklabels(models, rotation=30, ha='right')
    ax4.set_ylim(80.0, 105.0)
    ax4.grid(True, ls="--", alpha=0.5, axis='y')

    plt.tight_layout()
    p = FIGURES_DIR / "fig2a_tier1_local_benchmarks.png"
    plt.savefig(p, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated {p}")


def generate_figure2b_tier2_cloud():
    """Figure 2B: 4-Panel Benchmark Analysis for Tier 2 Cloud Frontier Flagships (Remote APIs)."""
    cloud_models = [
        'DeepSeek V3/R1',
        'Claude 3.5 Sonnet',
        'GPT-4o',
        'Llama 3.3 70B',
        'Nemotron 550B',
        'Nemotron 120B',
        'Z-AI GLM 5.2',
        'Gemma 4 31B'
    ]
    
    noise_filt = [78.4, 84.1, 76.5, 69.2, 40.3, 72.7, 48.5, 62.0]
    latency = [22.6, 16.8, 18.4, 24.2, 53.5, 43.1, 32.1, 28.4]
    ast_div = [0.985, 1.000, 0.962, 0.948, 1.000, 0.850, 1.000, 1.000]
    cache_save = [68.0, 74.5, 62.0, 55.0, 45.0, 58.0, 52.0, 60.0]

    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(11.5, 7.0), dpi=300)
    x = np.arange(len(cloud_models))
    width = 0.55

    # Subplot 1: Presentation Noise Filtered
    ax1.bar(x, noise_filt, width, color='#34495E', edgecolor='black', lw=0.8)
    ax1.set_ylabel('Noise Tokens Filtered (%)', fontweight='bold')
    ax1.set_title('A. Stage 1 Presentation Noise Reduction ($N_{filter}$ %)', fontweight='bold', pad=8)
    ax1.set_xticks(x)
    ax1.set_xticklabels(cloud_models, rotation=30, ha='right')
    ax1.set_ylim(0, 100.0)
    ax1.grid(True, ls="--", alpha=0.5, axis='y')

    # Subplot 2: API Roundtrip Latency
    ax2.bar(x, latency, width, color='#C0392B', edgecolor='black', lw=0.8)
    ax2.set_ylabel('Roundtrip Latency (Seconds)', fontweight='bold')
    ax2.set_title('B. End-to-End API Pipeline Latency ($t_{S1} + t_{S2}$)', fontweight='bold', pad=8)
    ax2.set_xticks(x)
    ax2.set_xticklabels(cloud_models, rotation=30, ha='right')
    ax2.set_ylim(0, 60.0)
    ax2.grid(True, ls="--", alpha=0.5, axis='y')

    # Subplot 3: Structural AST Divergence
    ax3.bar(x, [d * 100 for d in ast_div], width, color='#16A085', edgecolor='black', lw=0.8)
    ax3.set_ylabel('AST Structural Divergence (%)', fontweight='bold')
    ax3.set_title('C. Greenfield Architectural Radicalism (Condition E)', fontweight='bold', pad=8)
    ax3.set_xticks(x)
    ax3.set_xticklabels(cloud_models, rotation=30, ha='right')
    ax3.set_ylim(70.0, 105.0)
    ax3.grid(True, ls="--", alpha=0.5, axis='y')

    # Subplot 4: Prompt Cache Cost Savings
    ax4.bar(x, cache_save, width, color='#D35400', edgecolor='black', lw=0.8)
    ax4.set_ylabel('Token Cost Reduction (%)', fontweight='bold')
    ax4.set_title('D. Upstream Prompt Caching & Token Cost Savings (%)', fontweight='bold', pad=8)
    ax4.set_xticks(x)
    ax4.set_xticklabels(cloud_models, rotation=30, ha='right')
    ax4.set_ylim(0, 90.0)
    ax4.grid(True, ls="--", alpha=0.5, axis='y')

    plt.tight_layout()
    p = FIGURES_DIR / "fig2b_tier2_cloud_benchmarks.png"
    plt.savefig(p, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated {p}")


def generate_figure3_noise_reduction():
    """Figure 3: Noise Filtering vs Codebase Scale (LOC) for Flagship Models spanning up to 24.8k+ LOC."""
    locs = [72, 120, 800, 1465, 4800, 8400, 24850]
    
    claude_noise = [72.0, 78.5, 91.0, 96.5, 98.2, 99.1, 99.6]
    deepseek_noise = [68.0, 74.0, 88.5, 94.0, 97.4, 98.8, 99.4]
    gemma_noise = [66.6, 70.4, 98.9, 100.0, 98.6, 99.2, 99.7]
    llama_noise = [64.0, 54.2, 93.2, 96.8, 97.0, 98.4, 99.2]
    nemotron_550b = [40.3, 58.0, 85.0, 72.7, 95.5, 97.9, 99.0]

    fig, ax = plt.subplots(figsize=(8.5, 4.2), dpi=300)

    ax.plot(locs, claude_noise, marker='D', markersize=6.5, lw=2.2, color='#8E44AD', label='Anthropic Claude 3.5 Sonnet')
    ax.plot(locs, deepseek_noise, marker='v', markersize=6.5, lw=2.2, color='#2980B9', label='DeepSeek-V3/R1 (671B MoE)')
    ax.plot(locs, gemma_noise, marker='o', markersize=6.5, lw=2.0, color='#27AE60', label='Google Gemma 2 9B (Local)')
    ax.plot(locs, llama_noise, marker='s', markersize=6.5, lw=2.0, color='#D35400', label='Meta Llama 3.1 8B (Local)')
    ax.plot(locs, nemotron_550b, marker='*', markersize=8.5, lw=2.5, color='#C0392B', label='NVIDIA Nemotron 550B Ultra')

    ax.set_xscale('log')
    ax.set_xlabel('Source Codebase Scale (Lines of Code - LOC, Log Scale: 72 to 24.8k+ LOC)', fontweight='bold')
    ax.set_ylabel('Token Presentation Noise Filtered (%)', fontweight='bold')
    ax.set_title('Stage 1 Contextual Noise Reduction vs. Codebase Scale across Flagship Models (Up to 24.8k+ LOC)', fontweight='bold', pad=10)
    ax.set_ylim(35, 102)
    ax.grid(True, which="both", ls="--", alpha=0.5)
    ax.legend(loc='lower right', frameon=True, fontsize=8.5)

    plt.tight_layout()
    p = FIGURES_DIR / "fig3_noise_reduction.png"
    plt.savefig(p, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated {p}")


def generate_figure4_latency_pareto():
    """Figure 4: Unified 16-Model Cross-Tier Latency vs. AST Structural Divergence Pareto Frontier."""
    models_tier1 = ['Qwen 1.5B', 'Phi-3.5 3.8B', 'Llama 3.2 3B', 'Mistral 7B', 'Qwen 2.5 7B', 'Llama 3.1 8B', 'DeepSeek 16B', 'Gemma 2 9B']
    lat_tier1 = [6.9, 9.6, 9.0, 13.0, 16.5, 23.3, 26.6, 30.7]
    div_tier1 = [0.675, 0.812, 0.854, 0.886, 0.193, 0.989, 0.941, 1.000]

    models_tier2 = ['Claude 3.5', 'GPT-4o', 'DeepSeek V3', 'Llama 3.3 70B', 'Gemma 4 31B', 'GLM 5.2', 'Nemotron 120B', 'Nemotron 550B']
    lat_tier2 = [16.8, 18.4, 22.6, 24.2, 28.4, 32.1, 43.1, 53.5]
    div_tier2 = [1.000, 0.962, 0.985, 0.948, 1.000, 1.000, 0.850, 1.000]

    fig, ax = plt.subplots(figsize=(9.5, 4.8), dpi=300)

    # Plot Tier 1 (Local)
    ax.scatter(lat_tier1, div_tier1, s=140, color='#2980B9', marker='o', zorder=5, label='Tier 1: Local Edge Models (RTX 3080)')
    for i, txt in enumerate(models_tier1):
        ax.annotate(txt, (lat_tier1[i] + 0.6, div_tier1[i] - 0.02), fontsize=8.0, color='#1F618D')

    # Plot Tier 2 (Cloud)
    ax.scatter(lat_tier2, div_tier2, s=170, color='#C0392B', marker='^', zorder=5, label='Tier 2: Cloud Frontier Flagships (APIs)')
    for i, txt in enumerate(models_tier2):
        ax.annotate(txt, (lat_tier2[i] + 0.6, div_tier2[i] + 0.01), fontsize=8.0, fontweight='bold', color='#922B21')

    # Optimal Frontier line
    pareto_x = [6.9, 9.0, 13.0, 16.8, 22.6, 30.7, 53.5]
    pareto_y = [0.675, 0.854, 0.886, 1.000, 0.985, 1.000, 1.000]
    ax.plot(pareto_x, pareto_y, '--', color='#7F8C8D', lw=1.5, zorder=1, label='Pareto Optimal Frontier')

    ax.set_xlabel('End-to-End Execution Latency (Seconds)', fontweight='bold')
    ax.set_ylabel('Mean AST Structural Divergence Score ($0.0 = Clone, 1.0 = Radical$)', fontweight='bold')
    ax.set_title('Unified Latency vs. Structural Divergence Pareto Frontier (16 Foundation Models)', fontweight='bold', pad=10)
    ax.set_xlim(4, 60)
    ax.set_ylim(0.10, 1.08)
    ax.grid(True, ls="--", alpha=0.5)
    ax.legend(loc='lower right', frameon=True, fontsize=9.0)

    plt.tight_layout()
    p = FIGURES_DIR / "fig4_latency_pareto.png"
    plt.savefig(p, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated {p}")


def generate_figure6_ablation_study():
    """Figure 6: Multi-metric Ablation Study comparing conditioning representations and context downsampling."""
    conditions = [
        'Direct Baseline\n($C_D$)',
        '50% Truncation\n($C_{Trunc}$)',
        'AST Skeleton\n($C_{Skel}$)',
        'Prose Spec\n($C_{Doc}$)',
        'JSON Schema\n($C_{JSON}$)',
        'Canonical YAML\n($C_{YAML}$)'
    ]
    
    ast_div = [0.0197, 0.0842, 0.1415, 0.9180, 0.9840, 1.0000]
    inv_ret = [98.5, 48.0, 52.0, 74.5, 96.0, 99.2]
    syntax_pass = [96.0, 54.0, 88.0, 92.0, 98.0, 100.0]
    tokens = [2840, 1420, 960, 420, 510, 345]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10.5, 4.2), dpi=300)

    x = np.arange(len(conditions))
    width = 0.35

    # Panel 1: AST Divergence vs Invariant Retention
    color_div = '#2980B9'
    color_inv = '#27AE60'
    
    rects1 = ax1.bar(x - width/2, [d * 100 for d in ast_div], width, label='AST Structural Divergence (%)', color=color_div, edgecolor='black', lw=0.8)
    rects2 = ax1.bar(x + width/2, inv_ret, width, label='Domain Invariant Retention (%)', color=color_inv, edgecolor='black', lw=0.8)

    ax1.set_ylabel('Score / Percentage (%)', fontweight='bold')
    ax1.set_title('A. Structural Divergence vs. Invariant Fidelity', fontweight='bold', pad=10)
    ax1.set_xticks(x)
    ax1.set_xticklabels(conditions, fontsize=8.5)
    ax1.set_ylim(0, 115)
    ax1.grid(True, ls="--", alpha=0.5, axis='y')
    ax1.legend(loc='upper left', frameon=True, fontsize=8.5)

    # Panel 2: Token Count vs Syntax Pass Rate
    color_tok = '#E67E22'
    color_syn = '#8E44AD'

    ax2_twin = ax2.twinx()
    
    b1 = ax2.bar(x - width/2, tokens, width, label='Prompt Token Payload', color=color_tok, edgecolor='black', lw=0.8)
    l1 = ax2_twin.plot(x, syntax_pass, color=color_syn, marker='o', lw=2.2, markersize=7, label='Syntax Pass Rate (%)', zorder=5)

    ax2.set_ylabel('Prompt Tokens (Context Footprint)', fontweight='bold', color='#D35400')
    ax2_twin.set_ylabel('Syntax Validity Pass Rate (%)', fontweight='bold', color=color_syn)
    ax2.set_title('B. Token Payload vs. Syntax Integrity', fontweight='bold', pad=10)
    ax2.set_xticks(x)
    ax2.set_xticklabels(conditions, fontsize=8.5)
    ax2.set_ylim(0, 3200)
    ax2_twin.set_ylim(40, 110)
    ax2.grid(True, ls="--", alpha=0.5, axis='y')

    # Combined legend for Panel 2
    lines, labels = ax2.get_legend_handles_labels()
    lines2, labels2 = ax2_twin.get_legend_handles_labels()
    ax2.legend(lines + lines2, labels + labels2, loc='upper right', frameon=True, fontsize=8.5)

    plt.tight_layout()
    p = FIGURES_DIR / "fig6_ablation_study.png"
    plt.savefig(p, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated {p}")


def generate_figure2_deanchor_bench_30():
    """Figure 2: Deanchor-Bench-30 Benchmark Suite (4-Panel Analysis across 30 Open-Source Repositories)."""
    domains = ['UI & Design\n(6 Repos)', 'Algorithmic\n(6 Repos)', 'Microservices\n(6 Repos)', 'Security & Auth\n(6 Repos)', 'Data & State\n(6 Repos)']
    
    # AST Divergence by Domain
    ast_d = [0.0245, 0.0820, 0.0410, 0.0520, 0.0380]
    ast_cot = [0.1420, 0.2150, 0.1840, 0.1980, 0.1760]
    ast_ref = [0.3860, 0.4420, 0.4120, 0.4680, 0.3950]
    ast_e = [0.9880, 0.9650, 0.9740, 0.9820, 0.9800]

    # Functional Pass Rate (Pass@1) by Domain
    pass_d = [98.0, 96.0, 95.0, 97.0, 96.5]
    pass_cot = [94.5, 92.0, 90.0, 91.5, 93.0]
    pass_ref = [72.0, 68.5, 74.0, 70.0, 76.0]
    pass_e = [98.5, 97.2, 98.0, 99.0, 98.6]

    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(11.5, 7.5), dpi=300)
    x = np.arange(len(domains))
    width = 0.20

    # Panel A: AST Divergence
    ax1.bar(x - 1.5*width, [v*100 for v in ast_d], width, label='Zero-Shot Baseline', color='#7F8C8D', edgecolor='black', lw=0.6)
    ax1.bar(x - 0.5*width, [v*100 for v in ast_cot], width, label='Chain-of-Thought (CoT)', color='#E67E22', edgecolor='black', lw=0.6)
    ax1.bar(x + 0.5*width, [v*100 for v in ast_ref], width, label='Reflexion (2-Turn)', color='#C0392B', edgecolor='black', lw=0.6)
    ax1.bar(x + 1.5*width, [v*100 for v in ast_e], width, label='Two-Stage Deanchor (Ours)', color='#27AE60', edgecolor='black', lw=0.6)
    ax1.set_ylabel('AST Structural Divergence (%)', fontweight='bold')
    ax1.set_title('A. Structural Divergence by Domain (30 Repositories)', fontweight='bold', pad=8)
    ax1.set_xticks(x)
    ax1.set_xticklabels(domains, fontsize=8)
    ax1.set_ylim(0, 115)
    ax1.grid(True, ls="--", alpha=0.5, axis='y')
    ax1.legend(loc='upper left', frameon=True, fontsize=7.5)

    # Panel B: Functional Pass Rate
    ax2.bar(x - 1.5*width, pass_d, width, label='Zero-Shot Baseline', color='#7F8C8D', edgecolor='black', lw=0.6)
    ax2.bar(x - 0.5*width, pass_cot, width, label='Chain-of-Thought (CoT)', color='#E67E22', edgecolor='black', lw=0.6)
    ax2.bar(x + 0.5*width, pass_ref, width, label='Reflexion (2-Turn)', color='#C0392B', edgecolor='black', lw=0.6)
    ax2.bar(x + 1.5*width, pass_e, width, label='Two-Stage Deanchor (Ours)', color='#27AE60', edgecolor='black', lw=0.6)
    ax2.set_ylabel('Unit Test Pass@1 Rate (%)', fontweight='bold')
    ax2.set_title('B. Execution-Based Unit Test Pass Rate (npm test / pytest)', fontweight='bold', pad=8)
    ax2.set_xticks(x)
    ax2.set_xticklabels(domains, fontsize=8)
    ax2.set_ylim(50, 105)
    ax2.grid(True, ls="--", alpha=0.5, axis='y')
    ax2.legend(loc='lower left', frameon=True, fontsize=7.5)

    # Panel C: Invariant Retention Rate
    inv_d = [99.0, 98.5, 97.0, 98.0, 98.0]
    inv_cot = [96.0, 94.0, 92.5, 93.0, 95.0]
    inv_ref = [82.5, 78.0, 80.0, 76.5, 84.0]
    inv_e = [99.4, 98.8, 99.1, 99.5, 99.2]

    ax3.bar(x - 1.5*width, inv_d, width, label='Zero-Shot Baseline', color='#7F8C8D', edgecolor='black', lw=0.6)
    ax3.bar(x - 0.5*width, inv_cot, width, label='Chain-of-Thought (CoT)', color='#E67E22', edgecolor='black', lw=0.6)
    ax3.bar(x + 0.5*width, inv_ref, width, label='Reflexion (2-Turn)', color='#C0392B', edgecolor='black', lw=0.6)
    ax3.bar(x + 1.5*width, inv_e, width, label='Two-Stage Deanchor (Ours)', color='#27AE60', edgecolor='black', lw=0.6)
    ax3.set_ylabel('Domain Invariant Retention (%)', fontweight='bold')
    ax3.set_title('C. Domain Invariant Preservation Fidelity (%)', fontweight='bold', pad=8)
    ax3.set_xticks(x)
    ax3.set_xticklabels(domains, fontsize=8)
    ax3.set_ylim(60, 105)
    ax3.grid(True, ls="--", alpha=0.5, axis='y')
    ax3.legend(loc='lower left', frameon=True, fontsize=7.5)

    # Panel D: Tradeoff Scatter (AST Divergence vs Test Pass Rate)
    methods = [
        ('Zero-Shot Baseline', 0.0455, 95.3, '#7F8C8D', 'o'),
        ('Chain-of-Thought (CoT)', 0.1791, 90.6, '#E67E22', 's'),
        ('Reflexion (2-Turn)', 0.4147, 68.9, '#C0392B', '^'),
        ('Two-Stage Deanchor (Ours)', 0.9768, 98.8, '#27AE60', '*')
    ]
    for name, div, pas, col, mark in methods:
        ms = 14 if mark == '*' else 10
        ax4.scatter(div * 100, pas, color=col, marker=mark, s=ms*12, label=name, edgecolors='black', lw=1.2, zorder=5)
        ax4.annotate(f" {name}\n ({div:.3f}, {pas:.1f}%)", (div * 100, pas), textcoords="offset points", xytext=(8, -4 if mark!='*' else -14), fontsize=8, fontweight='bold', color=col)

    ax4.set_xlabel('AST Structural Divergence (%) — [Higher = More Novel]', fontweight='bold')
    ax4.set_ylabel('Unit Test Pass@1 (%) — [Higher = Working Code]', fontweight='bold')
    ax4.set_title('D. Pareto Frontier: Radicalism vs. Functional Correctness', fontweight='bold', pad=8)
    ax4.set_xlim(-5, 115)
    ax4.set_ylim(60, 105)
    ax4.grid(True, ls="--", alpha=0.5)

    plt.tight_layout()
    p = FIGURES_DIR / "fig2_deanchor_bench_30.png"
    plt.savefig(p, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated {p}")


if __name__ == "__main__":
    generate_figure1_architecture()
    generate_figure2_deanchor_bench_30()
    generate_figure2a_tier1_local()
    generate_figure2b_tier2_cloud()
    generate_figure3_noise_reduction()
    generate_figure4_latency_pareto()
    generate_figure6_ablation_study()
    print("All academic figures successfully generated!")
