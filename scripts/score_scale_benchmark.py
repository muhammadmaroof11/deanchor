#!/usr/bin/env python3
"""
Score AST Divergence and Embedding Distance for Scale Benchmark Runs.
"""

import sys
import json
import pathlib
import numpy as np
from bs4 import BeautifulSoup
from sentence_transformers import SentenceTransformer

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXPS = ROOT / "experiments"
RESULTS = ROOT / "results"

print("Loading local sentence transformer model...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")


def extract_features(file_path: pathlib.Path) -> dict:
    content = file_path.read_text(encoding="utf-8", errors="ignore")
    if file_path.suffix == ".html":
        soup = BeautifulSoup(content, "html.parser")
        tags = [tag.name for tag in soup.find_all()]
        classes = [c for tag in soup.find_all() for c in tag.get("class", [])]
        return {
            "tags": tags,
            "classes": classes,
            "text": soup.get_text(separator=" ", strip=True)
        }
    else:
        lines = [l.strip() for l in content.splitlines() if l.strip()]
        return {
            "tags": lines[:50],
            "classes": [l for l in lines if any(k in l for k in ["class", "function", "const", "let", "def", "import"])],
            "text": content
        }


def compute_structural_score(orig_feat: dict, gen_feat: dict) -> float:
    # Jaccard distance on structural tokens
    set_orig_tags = set(orig_feat["tags"])
    set_gen_tags = set(gen_feat["tags"])
    tag_union = set_orig_tags | set_gen_tags
    tag_dist = 1.0 - (len(set_orig_tags & set_gen_tags) / len(tag_union)) if tag_union else 0.0

    set_orig_cls = set(orig_feat["classes"])
    set_gen_cls = set(gen_feat["classes"])
    cls_union = set_orig_cls | set_gen_cls
    cls_dist = 1.0 - (len(set_orig_cls & set_gen_cls) / len(cls_union)) if cls_union else 0.0

    return float(0.5 * tag_dist + 0.5 * cls_dist)


def compute_embedding_distance(t1: str, t2: str) -> float:
    e1 = embedder.encode(t1[:4000], normalize_embeddings=True)
    e2 = embedder.encode(t2[:4000], normalize_embeddings=True)
    sim = float(np.dot(e1, e2))
    return float(1.0 - sim)


def main():
    subjects = [
        "design/subject_1",
        "design/subject_enterprise",
        "perf/subject_1",
        "realworld/design_portfolio",
        "realworld/perf_orderbook",
    ]

    models = ["mistral-7b-v03", "gemma-2-9b-it", "llama3.1-8b-official", "llama3.1-8b-q6k"]
    conditions = ["D", "E"]

    results = {}

    for s in subjects:
        subj_dir = EXPS / s
        if not subj_dir.exists():
            continue

        orig_file = None
        for cand in ["original.html", "original.js", "original.ts", "index.html"]:
            if (subj_dir / cand).is_file():
                orig_file = subj_dir / cand
                break

        if not orig_file:
            continue

        orig_feat = extract_features(orig_file)
        orig_text = orig_file.read_text(encoding="utf-8", errors="ignore")

        results[s] = {}

        for m in models:
            results[s][m] = {}
            for c in conditions:
                cand_dir = subj_dir / f"scale_{m}_condition_{c}"
                out_file = None
                for ext in [".html", ".md", ".js", ".ts"]:
                    if (cand_dir / f"output{ext}").is_file():
                        out_file = cand_dir / f"output{ext}"
                        break

                if out_file:
                    gen_feat = extract_features(out_file)
                    gen_text = out_file.read_text(encoding="utf-8", errors="ignore")
                    ast_score = compute_structural_score(orig_feat, gen_feat)
                    embed_dist = compute_embedding_distance(orig_text, gen_text)
                    results[s][m][c] = {
                        "ast_divergence": round(ast_score, 4),
                        "embedding_distance": round(embed_dist, 4)
                    }
                    print(f"{s} | {m} | Cond {c} -> AST: {ast_score:.4f}, Embed: {embed_dist:.4f}")

    out_json = RESULTS / "scale_benchmark_scores.json"
    out_json.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nSaved scale scores to {out_json}")


if __name__ == "__main__":
    main()
