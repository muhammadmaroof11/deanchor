#!/usr/bin/env python3
"""
Publication-Grade Figure Generator for Deanchor Research Paper.
Generates high-resolution 300 DPI academic charts and diagrams using Matplotlib.
"""

import matplotlib.pyplot as plt
import numpy as np
import pathlib

# Set publication style
plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
plt.rcParams['font.family'] = 'serif'
plt.rcParams['font.serif'] = ['Times New Roman', 'DejaVu Serif', 'Liberation Serif']
plt.rcParams['font.size'] = 10
plt.rcParams['axes.titlesize'] = 11
plt.rcParams['axes.labelsize'] = 10
plt.rcParams['xtick.labelsize'] = 9
plt.rcParams['ytick.labelsize'] = 9
plt.rcParams['legend.fontsize'] = 9
plt.rcParams['figure.titlesize'] = 12

FIGURES_DIR = pathlib.Path(__file__).resolve().parent.parent / "paper_figures"
FIGURES_DIR.mkdir(exist_ok=True)


def generate_figure1_architecture():
    """Figure 1: Architectural Workflow Diagram (Direct Attention Sink vs. Two-Stage Decoupling)."""
    fig, ax = plt.subplots(figsize=(8.0, 3.8), dpi=300)
    ax.axis('off')

    # Direct Baseline (Top)
    ax.text(0.02, 0.82, "A. Standard Direct Conditioning (Condition D — Baseline Attention Sink):", fontweight='bold', fontsize=9.5)
    
    # Boxes for Baseline
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


def generate_figure2_grand_benchmark():
    """Figure 2: Grouped Bar Chart comparing Condition D vs Condition E across all 4 models."""
    scenarios = ["Design\nComponent", "Enterprise\nMonolith", "Performance\nAlgorithm", "Real-World\nPortfolio", "Real-World\nOrderBook"]
    
    qwen_d = [0.0197, 0.4352, 0.0000, 0.3052, 0.2991]
    qwen_e = [0.1927, 0.4502, 0.1300, 0.3828, 0.4398]
    
    mistral_d = [0.5167, 0.9118, 0.6259, 0.6808, 0.9791]
    mistral_e = [0.8864, 0.8488, 1.0000, 0.8906, 1.0000]

    llama_d = [0.5476, 0.8495, 0.8700, 0.7073, 0.9609]
    llama_e = [0.8000, 1.0000, 0.9890, 0.7634, 1.0000]

    gemma_d = [0.8000, 1.0000, 0.7454, 1.0000, 0.7944]
    gemma_e = [1.0000, 1.0000, 1.0000, 1.0000, 1.0000]

    x = np.arange(len(scenarios))
    width = 0.09

    fig, ax = plt.subplots(figsize=(9.0, 4.2), dpi=300)

    # Plot bars
    ax.bar(x - 3.5*width, qwen_d, width, label='Qwen 2.5 7B (Zero-Shot)', color='#BDC3C7', hatch='//')
    ax.bar(x - 2.5*width, qwen_e, width, label='Qwen 2.5 7B (Decoupled)', color='#7F8C8D')

    ax.bar(x - 1.5*width, mistral_d, width, label='Mistral 7B (Zero-Shot)', color='#AED6F1', hatch='//')
    ax.bar(x - 0.5*width, mistral_e, width, label='Mistral 7B (Decoupled)', color='#2980B9')

    ax.bar(x + 0.5*width, llama_d, width, label='Llama 3.1 8B (Zero-Shot)', color='#FAD7A0', hatch='//')
    ax.bar(x + 1.5*width, llama_e, width, label='Llama 3.1 8B (Decoupled)', color='#D35400')

    ax.bar(x + 2.5*width, gemma_d, width, label='Gemma 2 9B (Zero-Shot)', color='#A9DFBF', hatch='//')
    ax.bar(x + 3.5*width, gemma_e, width, label='Gemma 2 9B (Decoupled)', color='#27AE60')

    ax.set_ylabel('AST Structural Divergence Score ($0.0 = Clone, 1.0 = Blank-Slate$)', fontweight='bold')
    ax.set_title('Cross-Architecture Structural Divergence: Zero-Shot Baseline (D) vs. Two-Stage Decoupling (E)', fontweight='bold', pad=10)
    ax.set_xticks(x)
    ax.set_xticklabels(scenarios)
    ax.set_ylim(0, 1.15)
    ax.axhline(1.0, color='gray', linestyle='--', alpha=0.5, lw=1)
    ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.15), ncol=4, frameon=True)

    plt.tight_layout()
    p = FIGURES_DIR / "fig2_grand_benchmark.png"
    plt.savefig(p, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated {p}")


def generate_figure3_noise_reduction():
    """Figure 3: Noise Filtering vs Codebase Scale (LOC)."""
    locs = [72, 120, 180, 800, 1465]
    labels = ["Design Component\n(72 LOC)", "Algo Engine\n(120 LOC)", "Security Gate\n(180 LOC)", "Portfolio Repo\n(800 LOC)", "Enterprise Monolith\n(1,465 LOC)"]
    
    gemma_noise = [66.6, 70.4, 19.1, 98.9, 100.0]
    llama_noise = [64.0, 54.2, 45.7, 93.2, 96.8]
    mistral_noise = [65.1, 59.6, 74.3, 83.8, 88.0]
    qwen_noise = [53.1, 76.5, 75.7, 85.6, 91.8]

    fig, ax = plt.subplots(figsize=(7.5, 3.8), dpi=300)

    ax.plot(locs, gemma_noise, marker='o', lw=2.0, color='#27AE60', label='Google Gemma 2 9B')
    ax.plot(locs, llama_noise, marker='s', lw=2.0, color='#D35400', label='Meta Llama 3.1 8B')
    ax.plot(locs, mistral_noise, marker='^', lw=2.0, color='#2980B9', label='Mistral AI 7B v0.3')
    ax.plot(locs, qwen_noise, marker='d', lw=2.0, color='#7F8C8D', label='Alibaba Qwen 2.5 7B')

    ax.set_xscale('log')
    ax.set_xlabel('Source Codebase Complexity (Lines of Code - LOC, Log Scale)', fontweight='bold')
    ax.set_ylabel('Token Presentation Noise Filtered (%)', fontweight='bold')
    ax.set_title('Stage 1 Contextual Noise Reduction vs. Codebase Scale', fontweight='bold', pad=10)
    ax.set_ylim(0, 110)
    ax.grid(True, which="both", ls="--", alpha=0.5)
    ax.legend(loc='lower right', frameon=True)

    plt.tight_layout()
    p = FIGURES_DIR / "fig3_noise_reduction.png"
    plt.savefig(p, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated {p}")


def generate_figure4_latency_pareto():
    """Figure 4: Latency vs AST Structural Divergence Pareto Frontier."""
    # Data points for small/medium files
    models = ['Mistral 7B v0.3', 'Alibaba Qwen 2.5 7B', 'Meta Llama 3.1 8B', 'Google Gemma 2 9B']
    latencies = [13.0, 17.1, 23.3, 30.7] # average latency in seconds
    divergence = [0.938, 0.771, 0.887, 0.955] # average AST divergence
    colors = ['#2980B9', '#7F8C8D', '#D35400', '#27AE60']
    markers = ['^', 'd', 's', 'o']

    fig, ax = plt.subplots(figsize=(7.2, 3.8), dpi=300)

    for i in range(len(models)):
        ax.scatter(latencies[i], divergence[i], s=160, color=colors[i], marker=markers[i], zorder=5, label=models[i])
        ax.annotate(models[i], (latencies[i] + 0.6, divergence[i] - 0.01), fontsize=9, fontweight='bold', color=colors[i])

    ax.plot([13.0, 23.3, 30.7], [0.938, 0.887, 0.955], '--', color='#BDC3C7', lw=1.5, zorder=1, label='Pareto Frontier')

    ax.set_xlabel('Average End-to-End Pipeline Latency on RTX 3080 GPU (Seconds)', fontweight='bold')
    ax.set_ylabel('Mean AST Structural Divergence Score', fontweight='bold')
    ax.set_title('Inference Latency vs. Structural Agency Tradeoff', fontweight='bold', pad=10)
    ax.set_xlim(10, 36)
    ax.set_ylim(0.70, 1.02)
    ax.grid(True, ls="--", alpha=0.5)

    plt.tight_layout()
    p = FIGURES_DIR / "fig4_latency_pareto.png"
    plt.savefig(p, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Generated {p}")


if __name__ == "__main__":
    generate_figure1_architecture()
    generate_figure2_grand_benchmark()
    generate_figure3_noise_reduction()
    generate_figure4_latency_pareto()
    print("All academic figures successfully generated!")
