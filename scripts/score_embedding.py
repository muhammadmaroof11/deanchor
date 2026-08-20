#!/usr/bin/env python3
"""
score_embedding.py
──────────────────
Method B: Embedding Cosine Distance

Embeds each output using the API's embedding endpoint (or local sentence-transformers)
and computes cosine distance from the original. Higher = more semantically divergent.

Score: 0.0 (identical meaning) → 1.0 (completely different meaning)
"""

import os
import sys
import json
import math
import time
import pathlib
import argparse
from typing import Dict, List, Optional

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    from openai import OpenAI
except ImportError:
    print("ERROR: openai not installed. Run: pip install openai")
    raise

ROOT    = pathlib.Path(__file__).parent.parent
EXPS    = ROOT / "experiments"
RESULTS = ROOT / "results"
RESULTS.mkdir(exist_ok=True)

API_KEY  = os.getenv("API_KEY",  "sk-o9rmaBPLNfY2E5ZXEOKOzQ")
API_BASE = os.getenv("API_BASE", "https://llm.smartax.pk/v1")

# Fallback to local sentence-transformers if API embedding fails
USE_LOCAL_EMBEDDINGS = os.getenv("USE_LOCAL_EMBEDDINGS", "false").lower() == "true"


def truncate(text: str, max_chars: int = 8000) -> str:
    """Truncate text to fit embedding context window."""
    return text[:max_chars]


def get_embedding_api(client: OpenAI, text: str) -> List[float]:
    """Get embedding from API."""
    response = client.embeddings.create(
        input=truncate(text),
        model="text-embedding-3-small",  # most endpoints support this
    )
    return response.data[0].embedding


def get_embedding_local(text: str) -> List[float]:
    """Get embedding using local sentence-transformers."""
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("all-MiniLM-L6-v2")
        return model.encode(truncate(text, 4000)).tolist()
    except ImportError:
        raise ImportError("sentence-transformers not installed. Run: pip install sentence-transformers")


def get_embedding(client: Optional[OpenAI], text: str) -> List[float]:
    """Get embedding, with local fallback."""
    if USE_LOCAL_EMBEDDINGS or client is None:
        return get_embedding_local(text)
    try:
        return get_embedding_api(client, text)
    except Exception as e:
        print(f"  API embedding failed ({e}), falling back to local...")
        return get_embedding_local(text)


def cosine_distance(v1: List[float], v2: List[float]) -> float:
    """1 - cosine_similarity. Range: 0.0 (identical) → 2.0 (opposite), normalized to 0-1."""
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 1.0
    similarity = dot / (norm1 * norm2)
    # cosine distance: 0 = identical, 1 = orthogonal, 2 = opposite
    # normalize to 0-1 by dividing by 2
    return min((1.0 - similarity) / 2.0 * 2, 1.0)


# Entry-point candidates for cloned repos
REPO_ENTRYPOINTS = [
    "app.js", "server.js", "index.js", "src/app.js", "src/server.js",
    "src/index.js", "app.py", "main.py", "server.py", "src/app.py",
    "app.ts", "server.ts", "src/main.ts",
]

def read_output(subj_path: pathlib.Path, condition: str) -> Optional[str]:
    cond_dir = subj_path / f"condition_{condition}"
    for ext in [".html", ".md", ".js", ".ts", ".py", ".txt"]:
        f = cond_dir / f"output{ext}"
        if f.exists():
            text = f.read_text(encoding="utf-8", errors="replace")
            # If markdown, extract only the code blocks so embeddings aren't inflated by README text
            if ext == ".md":
                import re
                blocks = re.findall(r'```[a-zA-Z]*\n(.*?)```', text, re.DOTALL)
                if blocks:
                    text = "\n\n".join(b.strip() for b in blocks if b.strip())
            return text
    return None


def read_original(subj_path: pathlib.Path) -> Optional[str]:
    target_file = None
    for ext in [".html", ".js", ".ts", ".py", ".jsx", ".tsx", ".css"]:
        f = subj_path / f"original{ext}"
        if f.exists():
            target_file = f
            break
            
    if not target_file:
        for name in REPO_ENTRYPOINTS:
            f = subj_path / name
            if f.exists():
                target_file = f
                break
                
    if not target_file:
        for ext in [".js", ".ts", ".py"]:
            candidates = sorted(subj_path.glob(f"*{ext}"), key=lambda p: p.stat().st_size, reverse=True)
            if candidates:
                target_file = candidates[0]
                break

    if target_file:
        return target_file.read_text(encoding="utf-8", errors="replace")
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode",    default="all")
    parser.add_argument("--subject", default=None)
    parser.add_argument("--output",  default="scores_embedding.json")
    parser.add_argument("--local",   action="store_true", help="Force local sentence-transformers")
    args = parser.parse_args()

    if args.local:
        os.environ["USE_LOCAL_EMBEDDINGS"] = "true"
        client = None
    else:
        client = OpenAI(api_key=API_KEY, base_url=API_BASE)

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

            original_text = read_original(subj_path)
            if original_text is None:
                print(f"[SKIP] No original in {subj_path}")
                continue

            print(f"\nEmbedding: {mode}/{subj_path.name}")
            print(f"  Getting original embedding...")
            t0 = time.time()
            orig_emb = get_embedding(client, original_text)
            print(f"  ✓ Original embedded ({time.time()-t0:.1f}s, dim={len(orig_emb)})")

            subj_results = {}

            for cond in conditions:
                output_text = read_output(subj_path, cond)
                if output_text is None:
                    print(f"  Condition {cond}: [no output]")
                    subj_results[cond] = None
                    continue

                try:
                    print(f"  Getting Condition {cond} embedding...")
                    t0 = time.time()
                    cond_emb = get_embedding(client, output_text)
                    dist = cosine_distance(orig_emb, cond_emb)
                    elapsed = time.time() - t0

                    subj_results[cond] = {
                        "embedding_score": round(dist, 4),
                        "elapsed_s": round(elapsed, 2),
                        "embedding_dim": len(cond_emb),
                    }
                    print(f"  Condition {cond}: {dist:.4f} ({elapsed:.1f}s)")
                    time.sleep(0.5)  # rate limit

                except Exception as e:
                    print(f"  Condition {cond}: ERROR — {e}")
                    subj_results[cond] = {"error": str(e)}

            all_results[mode][subj_path.name] = subj_results

    out_file = RESULTS / args.output
    out_file.write_text(json.dumps(all_results, indent=2))
    print(f"\nSaved: {out_file}")

    print("\n── SUMMARY ──")
    for mode, subjects in all_results.items():
        print(f"\n{mode.upper()}")
        for subj, conds in subjects.items():
            scores = {}
            for c, v in conds.items():
                if v and "embedding_score" in v:
                    scores[c] = v["embedding_score"]
                else:
                    scores[c] = None
            print(f"  {subj}: {scores}")


if __name__ == "__main__":
    main()
