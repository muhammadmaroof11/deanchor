#!/usr/bin/env python3
"""
score_structural.py
───────────────────
Method A: Structural Divergence Score

Parses HTML/code outputs into feature vectors and computes
Euclidean divergence from the original. Score: 0.0 (identical) → 1.0 (maximally different).

For HTML: extracts tag distribution, class name entropy, nesting depth profile,
          unique layout keywords, DOM size.
For code: extracts import list, function/class count, control flow pattern, line count.
"""

import os
import sys
import json
import math
import pathlib
import argparse
import re
from collections import Counter
from typing import Dict, List, Tuple, Optional

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: beautifulsoup4 not installed. Run: pip install beautifulsoup4")
    raise

ROOT = pathlib.Path(__file__).parent.parent
EXPS = ROOT / "experiments"
RESULTS = ROOT / "results"
RESULTS.mkdir(exist_ok=True)

# Layout paradigm keywords — presence = anchoring signal
LAYOUT_KEYWORDS = {
    "sidebar":      ["sidebar", "side-bar", "aside", "nav-side"],
    "topbar":       ["topbar", "top-bar", "header", "navbar", "nav-bar"],
    "card_grid":    ["card", "grid", "kpi", "metric", "tile"],
    "data_table":   ["table", "tbody", "thead", "tr", "td"],
    "hero_section": ["hero", "jumbotron", "banner", "landing"],
    "feature_cols": ["features", "feature-grid", "cols", "columns"],
    "pricing":      ["pricing", "plan", "tier"],
    "footer":       ["footer", "foot"],
}


# Entry-point candidates for cloned repos (checked in order)
REPO_ENTRYPOINTS = [
    "app.js", "server.js", "index.js", "src/app.js", "src/server.js",
    "src/index.js", "app.py", "main.py", "server.py", "src/app.py",
    "app.ts", "server.ts", "src/main.ts",
]


def find_entrypoint(subj_path: pathlib.Path) -> Optional[pathlib.Path]:
    """For cloned repos: find a representative source file to analyse."""
    # 1. Single-file subjects (original.*)
    for ext in [".html", ".js", ".ts", ".py", ".jsx", ".tsx", ".css", ".htm"]:
        f = subj_path / f"original{ext}"
        if f.exists():
            return f
    # 2. Named entrypoints
    for name in REPO_ENTRYPOINTS:
        f = subj_path / name
        if f.exists():
            return f
    # 3. Largest .js / .py file in root (rough heuristic)
    for ext in [".js", ".ts", ".py"]:
        candidates = sorted(subj_path.glob(f"*{ext}"),
                            key=lambda p: p.stat().st_size, reverse=True)
        if candidates:
            return candidates[0]
    return None


def extract_html_features(html: str) -> Dict[str, float]:
    """Extract a feature vector from an HTML string."""
    soup = BeautifulSoup(html, "html.parser")

    # 1. Tag distribution (normalized by total tags)
    all_tags = [t.name for t in soup.find_all() if t.name]
    tag_counts = Counter(all_tags)
    total_tags = max(len(all_tags), 1)

    tag_features = {}
    for tag in ["div", "section", "aside", "nav", "header", "main", "article",
                "table", "ul", "li", "span", "button", "svg", "canvas"]:
        tag_features[f"tag_{tag}"] = tag_counts.get(tag, 0) / total_tags

    # 2. Class entropy (diversity of class names)
    all_classes = []
    for el in soup.find_all(class_=True):
        all_classes.extend(el.get("class", []))
    class_counts = Counter(all_classes)
    if class_counts:
        total_cls = sum(class_counts.values())
        probs = [c / total_cls for c in class_counts.values()]
        entropy = -sum(p * math.log2(p) for p in probs if p > 0)
        class_entropy = min(entropy / 10.0, 1.0)  # normalize
    else:
        class_entropy = 0.0

    # 3. Nesting depth (average depth of leaf nodes)
    def get_depth(el, depth=0):
        children = list(el.children)
        if not any(hasattr(c, 'children') for c in children):
            return depth
        return max((get_depth(c, depth+1) for c in children if hasattr(c, 'children')), default=depth)

    avg_depth = min(get_depth(soup) / 20.0, 1.0)

    # 4. Layout keyword presence
    raw_html_lower = html.lower()
    layout_flags = {}
    for paradigm, keywords in LAYOUT_KEYWORDS.items():
        present = any(kw in raw_html_lower for kw in keywords)
        layout_flags[f"layout_{paradigm}"] = 1.0 if present else 0.0

    # 5. CSS complexity (number of CSS rules, custom properties)
    style_tags = soup.find_all("style")
    css_text = " ".join(s.get_text() for s in style_tags)
    num_selectors = len(re.findall(r'[^{}]+\{', css_text))
    num_vars = len(re.findall(r'--[\w-]+', css_text))
    num_animations = len(re.findall(r'@keyframes', css_text))
    css_features = {
        "css_selectors": min(num_selectors / 200.0, 1.0),
        "css_vars":      min(num_vars / 50.0, 1.0),
        "css_animations": min(num_animations / 10.0, 1.0),
    }

    # 6. DOM size
    dom_size = min(total_tags / 300.0, 1.0)

    return {
        **tag_features,
        "class_entropy": class_entropy,
        "avg_depth": avg_depth,
        **layout_flags,
        **css_features,
        "dom_size": dom_size,
    }


def extract_code_features(code: str) -> Dict[str, float]:
    """Extract feature vector from code (JS/TS/Python)."""
    lines = code.splitlines()
    total_lines = max(len(lines), 1)

    # Import/require count
    imports = len(re.findall(r'^\s*(import|require|from)\s', code, re.MULTILINE))
    # Function/class count
    fns = len(re.findall(r'\b(function|def|class|const \w+ = \(|=> {)', code))
    # Control flow
    ifs = len(re.findall(r'\bif\b', code))
    loops = len(re.findall(r'\b(for|while|forEach|map|filter|reduce)\b', code))
    # Async patterns
    async_patterns = len(re.findall(r'\b(async|await|Promise|then|catch)\b', code))
    # useEffect / component pattern (React anchoring signal)
    use_effect = len(re.findall(r'useEffect', code))
    react_hooks = len(re.findall(r'\buse[A-Z]\w+\(', code))

    return {
        "imports":        min(imports / 20.0, 1.0),
        "functions":      min(fns / 30.0, 1.0),
        "control_flow":   min((ifs + loops) / 50.0, 1.0),
        "async_patterns": min(async_patterns / 20.0, 1.0),
        "use_effect":     min(use_effect / 5.0, 1.0),
        "react_hooks":    min(react_hooks / 10.0, 1.0),
        "line_count":     min(total_lines / 500.0, 1.0),
    }


def extract_features(file_path: pathlib.Path, target_ext: str = "") -> Dict[str, float]:
    """Auto-detect file type and extract features. 
       If markdown, isolate code blocks to avoid scoring README text/JSON."""
    text = file_path.read_text(encoding="utf-8", errors="replace")
    
    # Isolate code blocks if it's a markdown output
    if file_path.suffix == ".md":
        blocks = re.findall(r'```[a-zA-Z]*\n(.*?)```', text, re.DOTALL)
        if blocks:
            # Join all code blocks, ignoring empty ones
            text = "\n\n".join(b.strip() for b in blocks if b.strip())

    # Use provided target_ext (from the original subject) or default to the file's own suffix
    ext = target_ext if target_ext else file_path.suffix
    
    if ext in [".html", ".htm"]:
        return extract_html_features(text)
    else:
        return extract_code_features(text)


def euclidean_distance(v1: Dict, v2: Dict) -> float:
    """Compute normalized Euclidean distance between two feature vectors."""
    keys = set(v1.keys()) | set(v2.keys())
    dist = sum((v1.get(k, 0) - v2.get(k, 0)) ** 2 for k in keys)
    max_dist = math.sqrt(len(keys))  # max possible if all dims are 0-1
    return min(math.sqrt(dist) / max_dist, 1.0)


def score_subject(subj_path: pathlib.Path, original_features: Dict, conditions: List[str], original_ext: str = "") -> Dict:
    """Score all condition outputs for a subject."""
    results = {}
    for cond in conditions:
        cond_dir = subj_path / f"condition_{cond}"
        output = None
        for ext in [".html", ".md", ".js", ".ts", ".py"]:
            f = cond_dir / f"output{ext}"
            if f.exists():
                output = f
                break

        if output is None:
            results[cond] = None
            continue

        cond_features = extract_features(output, original_ext)
        score = euclidean_distance(original_features, cond_features)
        results[cond] = {
            "structural_score": round(score, 4),
            "features": cond_features,
        }

    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode",    default="all")
    parser.add_argument("--subject", default=None)
    parser.add_argument("--output",  default="scores_structural.json")
    args = parser.parse_args()

    modes = [d.name for d in EXPS.iterdir() if d.is_dir()] if args.mode == "all" else [args.mode]
    conditions = ["A", "B", "C", "D", "E"]

    all_results = {}

    for mode in modes:
        mode_dir = EXPS / mode
        if not mode_dir.exists():
            continue
        all_results[mode] = {}

        subjects = sorted(mode_dir.iterdir()) if not args.subject else [mode_dir / args.subject]

        for subj_path in subjects:
            if not subj_path.is_dir():
                continue

            # Find original (works for both hand-written files and cloned repos)
            original = find_entrypoint(subj_path)

            if original is None:
                print(f"[SKIP] No entrypoint found in {subj_path}")
                continue

            print(f"Scoring: {mode}/{subj_path.name}")
            orig_features = extract_features(original)
            subj_results = score_subject(subj_path, orig_features, conditions, original.suffix)
            all_results[mode][subj_path.name] = subj_results

            for cond, res in subj_results.items():
                if res:
                    print(f"  Condition {cond}: {res['structural_score']:.4f}")
                else:
                    print(f"  Condition {cond}: [no output]")

    # Save
    out_file = RESULTS / args.output
    out_file.write_text(json.dumps(all_results, indent=2))
    print(f"\nSaved: {out_file}")

    # Print summary
    print("\n── SUMMARY ──")
    for mode, subjects in all_results.items():
        print(f"\n{mode.upper()}")
        for subj, conds in subjects.items():
            scores = {c: v["structural_score"] if v else None for c, v in conds.items()}
            print(f"  {subj}: {scores}")


if __name__ == "__main__":
    main()
