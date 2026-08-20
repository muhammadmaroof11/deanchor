#!/usr/bin/env python3
"""
Automated CLI Test & Verification Suite for Deanchor Engine.
Tests all model backends (Gemma 2 9B, Mistral 7B, Llama 3.1 8B, Qwen 2.5 7B)
across synthetic and real-world scenarios, recording outputs and metrics.
"""

import sys
import json
import time
import pathlib
import numpy as np
from bs4 import BeautifulSoup
from sentence_transformers import SentenceTransformer

# Reconfigure console encoding
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from deanchor.engine import DeanchorEngine, detect_niche

print("Loading SentenceTransformer for semantic scoring...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")


def extract_features(file_path: pathlib.Path) -> dict:
    content = file_path.read_text(encoding="utf-8", errors="ignore")
    if file_path.suffix == ".html":
        soup = BeautifulSoup(content, "html.parser")
        tags = [tag.name for tag in soup.find_all()]
        classes = [c for tag in soup.find_all() for c in tag.get("class", [])]
        return {"tags": tags, "classes": classes, "text": soup.get_text(separator=" ", strip=True)}
    else:
        lines = [l.strip() for l in content.splitlines() if l.strip()]
        return {
            "tags": lines[:50],
            "classes": [l for l in lines if any(k in l for k in ["class", "function", "const", "let", "def", "import"])],
            "text": content
        }


def compute_structural_score(orig_feat: dict, gen_feat: dict) -> float:
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
    return float(1.0 - np.dot(e1, e2))


def main():
    test_scenarios = [
        ("design/subject_1", "design"),
        ("design/subject_enterprise", "design"),
        ("perf/subject_1", "perf"),
        ("sec/subject_1", "sec"),
        ("realworld/design_portfolio", "design"),
    ]

    models_to_test = ["gemma", "mistral", "llama", "qwen"]

    full_results = {}

    for model_key in models_to_test:
        print(f"\n{'═'*70}")
        print(f"INITIALIZING DEANCHOR ENGINE WITH MODEL: {model_key.upper()}")
        print(f"{'═'*70}")

        try:
            engine = DeanchorEngine(model_identifier=model_key, n_ctx=16384)
            engine.initialize()
        except Exception as e:
            print(f"[ERROR] Could not load model {model_key}: {e}")
            continue

        full_results[model_key] = {}

        for subj_rel, default_niche in test_scenarios:
            subj_dir = ROOT / "experiments" / subj_rel
            if not subj_dir.exists():
                continue

            orig_file = None
            for cand in ["original.html", "original.js", "original.ts", "index.html"]:
                if (subj_dir / cand).is_file():
                    orig_file = subj_dir / cand
                    break

            if not orig_file:
                continue

            content = orig_file.read_text(encoding="utf-8", errors="ignore")
            niche = detect_niche(orig_file, default_niche)

            print(f"\n  ▶ Testing [{subj_rel}] (Niche: {niche.upper()}) on {model_key.upper()}...")
            
            try:
                res = engine.deanchor(content, niche=niche)
            except Exception as e:
                print(f"    [FAIL] {e}")
                continue

            metrics = res["metrics"]
            schema_text = res["stage1_schema"]
            output_text = res["stage2_output"]

            # Clean markdown wrappers if present
            lines = output_text.strip().splitlines()
            if len(lines) >= 2 and lines[0].startswith("```") and lines[-1].strip() == "```":
                clean_output = "\n".join(lines[1:-1]).strip()
            else:
                clean_output = output_text

            # Save test outputs
            out_dir = subj_dir / f"deanchor_cli_{model_key}"
            out_dir.mkdir(exist_ok=True)
            ext = orig_file.suffix if niche == "design" else ".md"

            (out_dir / "stage1_schema.yaml").write_text(schema_text, encoding="utf-8")
            (out_dir / f"output{ext}").write_text(clean_output, encoding="utf-8")

            # Score outputs
            orig_feat = extract_features(orig_file)
            gen_feat = extract_features(out_dir / f"output{ext}")
            ast_score = compute_structural_score(orig_feat, gen_feat)
            embed_dist = compute_embedding_distance(orig_feat["text"], gen_feat["text"])

            full_results[model_key][subj_rel] = {
                "niche": niche,
                "stage1_time": metrics["stage1_time_sec"],
                "stage2_time": metrics["stage2_time_sec"],
                "total_time": metrics["total_time_sec"],
                "noise_reduction_pct": metrics["token_noise_reduction_pct"],
                "output_chars": len(clean_output),
                "ast_divergence": round(ast_score, 4),
                "embedding_distance": round(embed_dist, 4),
                "syntax_valid": metrics.get("syntax_valid", True),
                "syntax_errors": metrics.get("syntax_errors", [])
            }

            syntax_str = "PASSED" if metrics.get("syntax_valid", True) else f"WARNING ({len(metrics.get('syntax_errors', []))} issues)"
            print(f"    ✓ Total Time: {metrics['total_time_sec']}s (S1: {metrics['stage1_time_sec']}s, S2: {metrics['stage2_time_sec']}s)")
            print(f"    ✓ Noise Reduced: {metrics['token_noise_reduction_pct']}% | Syntax: {syntax_str}")
            print(f"    ✓ AST Divergence: {ast_score:.4f} | Semantic Distance: {embed_dist:.4f}")

        # Free GPU memory before next model
        del engine

    out_json = ROOT / "results" / "deanchor_cli_full_results.json"
    out_json.write_text(json.dumps(full_results, indent=2), encoding="utf-8")
    print(f"\n{'═'*70}")
    print(f"All CLI Engine tests complete! Results saved to {out_json}")
    print(f"{'═'*70}")


if __name__ == "__main__":
    main()
