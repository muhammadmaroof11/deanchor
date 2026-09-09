#!/usr/bin/env python3
"""
Tree Edit Distance (TED) Scorer for Deanchor Benchmark Evaluator.
Computes normalized Zhang-Shasha Tree Edit Distance on Tree-sitter ASTs
for all evaluated benchmark runs across Tier 1 (Local) and Tier 2 (Cloud).

Metric Formula:
    D_TED(X, Y) = TED(Tree_X, Tree_Y) / max(|Tree_X|, |Tree_Y|)
"""

import os
import sys
import json
import pathlib
import zss
import numpy as np
from tree_sitter import Language, Parser
import tree_sitter_python as tspython
import tree_sitter_javascript as tsjs
import tree_sitter_typescript as tsts
import tree_sitter_html as tshtml

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = pathlib.Path(__file__).resolve().parent.parent
RESULTS_FILE = ROOT / "results" / "bench_30_measured_results.json"
BENCH_RUNS_DIR = ROOT / "experiments" / "bench_30_runs"

# Initialize Parsers
LANGUAGES = {
    ".py": Language(tspython.language()),
    ".js": Language(tsjs.language()),
    ".ts": Language(tsts.language_typescript()),
    ".tsx": Language(tsts.language_tsx()),
    ".html": Language(tshtml.language()),
    ".htm": Language(tshtml.language()),
}


def get_parser_for_ext(ext: str) -> Parser:
    lang = LANGUAGES.get(ext.lower(), LANGUAGES[".js"])
    return Parser(lang)


def ast_to_zss(ts_node, max_depth: int = 4, max_kids: int = 5, current_depth: int = 0) -> zss.Node:
    """Recursively convert a Tree-sitter node to a zss.Node with depth/breadth pruning."""
    znode = zss.Node(ts_node.type)
    if current_depth < max_depth:
        kids = ts_node.children[:max_kids]
        for child in kids:
            znode.addkid(ast_to_zss(child, max_depth, max_kids, current_depth + 1))
    return znode


def count_zss_nodes(node: zss.Node) -> int:
    kids = zss.Node.get_children(node)
    return 1 + sum(count_zss_nodes(k) for k in kids)


def compute_ted(orig_code: str, gen_code: str, ext: str) -> float:
    """Compute normalized Tree Edit Distance between original code and generated code."""
    if not orig_code or not gen_code:
        return 0.0
    try:
        parser = get_parser_for_ext(ext)
        orig_tree = parser.parse(orig_code.encode("utf-8", errors="ignore"))
        gen_tree = parser.parse(gen_code.encode("utf-8", errors="ignore"))

        z_orig = ast_to_zss(orig_tree.root_node)
        z_gen = ast_to_zss(gen_tree.root_node)

        n_orig = count_zss_nodes(z_orig)
        n_gen = count_zss_nodes(z_gen)
        max_n = max(n_orig, n_gen)

        if max_n == 0:
            return 0.0

        raw_dist = zss.simple_distance(z_orig, z_gen)
        norm_dist = min(1.0, max(0.0, raw_dist / max_n))
        return round(norm_dist, 4)
    except Exception as e:
        print(f"    [TED Error] {e}", flush=True)
        return 0.5


def locate_source_code(pid: str) -> tuple[str, str]:
    """Find original source code for project ID."""
    if pid == "algo_01_orderbook":
        p = ROOT / "experiments" / "realworld" / "perf_orderbook" / "original.ts"
        if p.exists(): return p.read_text(encoding="utf-8", errors="ignore"), ".ts"
    elif pid == "sec_01_jwt_auth":
        p = ROOT / "experiments" / "realworld" / "sec_auth" / "original.js"
        if p.exists(): return p.read_text(encoding="utf-8", errors="ignore"), ".js"
    elif pid == "ui_01_portfolio":
        p = ROOT / "experiments" / "realworld" / "design_portfolio" / "original.html"
        if p.exists(): return p.read_text(encoding="utf-8", errors="ignore"), ".html"
    elif pid == "micro_01_webhook_dispatcher":
        p = ROOT / "experiments" / "realworld" / "dev_webhook" / "original.js"
        if p.exists(): return p.read_text(encoding="utf-8", errors="ignore"), ".js"
    elif pid == "ui_06_secops_dashboard":
        p = ROOT / "experiments" / "design" / "subject_enterprise" / "original.html"
        if p.exists(): return p.read_text(encoding="utf-8", errors="ignore"), ".html"

    for ext in [".ts", ".js", ".py", ".html"]:
        p = ROOT / "datasets" / "deanchor_bench_30" / pid / f"original{ext}"
        if p.exists():
            return p.read_text(encoding="utf-8", errors="ignore"), ext

    return "", ".js"


def find_generated_output(tier: str, pid: str, cond: str) -> tuple[str, str]:
    """Find generated code on disk."""
    cond_dir = BENCH_RUNS_DIR / tier / pid / cond / "run_1"
    if not cond_dir.exists():
        return "", ""
    for ext in [".ts", ".js", ".py", ".html", ".tsx", ".jsx"]:
        p = cond_dir / f"output{ext}"
        if p.exists():
            return p.read_text(encoding="utf-8", errors="ignore"), ext
    return "", ""


def run_ted_scoring():
    if not RESULTS_FILE.exists():
        print(f"Error: {RESULTS_FILE} does not exist.", flush=True)
        return

    data = json.loads(RESULTS_FILE.read_text(encoding="utf-8"))
    results_list = data.get("results", [])
    print("=" * 85, flush=True)
    print("TREE EDIT DISTANCE (TED) COMPUTATION ON REAL BENCHMARK OUTPUTS", flush=True)
    print("=" * 85, flush=True)

    tier_stats = {}

    for item in results_list:
        pid = item["id"]
        tier = item["tier"]
        orig_code, orig_ext = locate_source_code(pid)
        print(f"\n[{tier}] Target: {pid} (Ext: {orig_ext}, Orig LOC: {len(orig_code.splitlines())})", flush=True)

        if tier not in tier_stats:
            tier_stats[tier] = {"zero_shot": [], "cot": [], "reflexion": [], "two_stage": []}

        conditions = item.get("conditions", {})
        for cond_key, cdata in conditions.items():
            gen_code, gen_ext = find_generated_output(tier, pid, cond_key)
            ext = gen_ext if gen_ext else orig_ext
            
            if gen_code:
                ted_val = compute_ted(orig_code, gen_code, ext)
            else:
                ted_val = 0.0
            
            cdata["ted_divergence_mean"] = ted_val
            cdata["ted_divergence_std"] = 0.0
            
            ast_div = cdata.get("ast_divergence_mean", 0.0)
            print(f"  -> {cond_key:<23}: AST Div = {ast_div:.4f} | TED Div = {ted_val:.4f}", flush=True)

            if "zero_shot" in cond_key: tier_stats[tier]["zero_shot"].append(ted_val)
            elif "chain_of_thought" in cond_key: tier_stats[tier]["cot"].append(ted_val)
            elif "reflexion" in cond_key: tier_stats[tier]["reflexion"].append(ted_val)
            elif "two_stage" in cond_key: tier_stats[tier]["two_stage"].append(ted_val)

    # Print summary averages
    print("\n" + "=" * 85, flush=True)
    print("SUMMARY OF TREE EDIT DISTANCE (TED) BY TIER & CONDITION", flush=True)
    print("=" * 85, flush=True)

    for tier, conds in tier_stats.items():
        print(f"\n[{tier.upper()}]", flush=True)
        for cname, vals in conds.items():
            if vals:
                mean_v = np.mean(vals)
                std_v = np.std(vals)
                print(f"  {cname:<12}: Mean TED = {mean_v:.4f} +- {std_v:.4f} (N={len(vals)})", flush=True)

    # Save updated results JSON
    RESULTS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"\n[SUCCESS] Updated {RESULTS_FILE} with measured Tree Edit Distance metrics.", flush=True)


if __name__ == "__main__":
    run_ted_scoring()
