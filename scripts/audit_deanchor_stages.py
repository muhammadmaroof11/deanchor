# -*- coding: utf-8 -*-
"""
Deanchor Stage Audit Script
============================
Runs the Two-Stage Decoupling Protocol on 5 representative real-world
targets (one per domain) and audits whether:

  Stage 1: Critical domain entities, invariants, edge cases, and API
           contracts are correctly extracted from the original source.

  Stage 2: The synthesized output retains the extracted entities and
           invariants (no silent drops across the information bottleneck).

Uses the live Gemini API for inference and a secondary LLM call to
grade the extraction quality (LLM-as-judge).

Usage:
    python scripts/audit_deanchor_stages.py [--target <id>] [--all]
"""

import sys
import os
import json
import time
import pathlib
import argparse
import textwrap

# Add project root to path
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from deanchor.engine import DeanchorEngine, detect_niche, validate_syntax
from deanchor.prompts import STAGE1_SCHEMAS, STAGE2_PROMPTS
from deanchor.models import load_llm, CloudLLMClient, get_default_provider_and_model

# ── Representative targets: one per domain ────────────────────────────
AUDIT_TARGETS = {
    "ui_01_portfolio": {
        "domain": "design",
        "source_file": "original.html",
        "critical_entities": [
            "navigation/menu items",
            "project/portfolio cards or items",
            "contact form or contact info",
            "social links",
            "section headings/titles",
        ],
        "critical_invariants": [
            "page must have navigation",
            "portfolio/project items must be present",
            "contact information must be reachable",
        ],
    },
    "algo_01_orderbook": {
        "domain": "perf",
        "source_file": "original.ts",
        "critical_entities": [
            "order types (limit, market, stop)",
            "bid/ask sides",
            "order matching logic",
            "price-time priority",
            "order cancellation",
        ],
        "critical_invariants": [
            "buy orders matched against best ask",
            "sell orders matched against best bid",
            "partial fills must be tracked",
            "self-trade prevention",
        ],
    },
    "sec_01_jwt_auth": {
        "domain": "sec",
        "source_file": "original.js",
        "critical_entities": [
            "JWT token creation",
            "token verification/validation",
            "user roles or permissions",
            "refresh token mechanism",
            "password hashing",
        ],
        "critical_invariants": [
            "tokens must expire",
            "invalid tokens must be rejected",
            "role-based access control enforced",
        ],
    },
    "micro_01_webhook_dispatcher": {
        "domain": "dev",
        "source_file": "original.js",
        "critical_entities": [
            "webhook event types",
            "payload dispatch/routing",
            "signature/HMAC verification",
            "HTTP endpoint handler",
        ],
        "critical_invariants": [
            "webhook signature must be verified before processing",
            "events must be routed to correct handler",
            "invalid payloads must be rejected",
        ],
    },
    "data_01_cache_lru": {
        "domain": "dev",
        "source_file": "original.ts",
        "critical_entities": [
            "cache get/set operations",
            "eviction policy (LRU/LFU)",
            "max capacity enforcement",
            "TTL/expiry support",
        ],
        "critical_invariants": [
            "least recently used items evicted first when full",
            "capacity must never be exceeded",
            "expired items must not be returned",
        ],
    },
}


def load_source(target_id: str) -> str:
    """Load the original source code for a target."""
    cfg = AUDIT_TARGETS[target_id]
    path = ROOT / "datasets" / "deanchor_bench_30" / target_id / cfg["source_file"]
    if not path.exists():
        raise FileNotFoundError(f"Source not found: {path}")
    return path.read_text(encoding="utf-8", errors="replace")


def run_stage1(llm: CloudLLMClient, source: str, niche: str) -> str:
    """Run Stage 1 schema extraction."""
    niche_key = niche if niche in STAGE1_SCHEMAS else "design"
    prompt = STAGE1_SCHEMAS[niche_key].format(content=source)
    resp = llm.create_chat_completion(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=3000,
    )
    return resp["choices"][0]["message"]["content"]


def run_stage2(llm: CloudLLMClient, schema: str, niche: str) -> str:
    """Run Stage 2 synthesis from the extracted schema."""
    niche_key = niche if niche in STAGE2_PROMPTS else "design"
    prompt = STAGE2_PROMPTS[niche_key].format(schema=schema)
    # Use higher token limit for design niche which needs full HTML output
    s2_max_tokens = 8192 if niche_key == "design" else 6000
    resp = llm.create_chat_completion(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.85,
        max_tokens=s2_max_tokens,
    )
    return resp["choices"][0]["message"]["content"]


def grade_extraction(
    llm: CloudLLMClient,
    stage_label: str,
    original_source: str,
    output_text: str,
    critical_entities: list,
    critical_invariants: list,
) -> dict:
    """Use LLM-as-judge to grade whether critical entities/invariants survived."""

    entity_list = "\n".join(f"  - {e}" for e in critical_entities)
    invariant_list = "\n".join(f"  - {inv}" for inv in critical_invariants)

    judge_prompt = f"""You are a scientific audit judge for a code transformation protocol.

TASK: Evaluate whether the following {stage_label} output preserves the critical domain information from the original source.

ORIGINAL SOURCE CODE (first 2000 chars):
```
{original_source[:2000]}
```

{stage_label.upper()} OUTPUT:
```
{output_text[:3000]}
```

CRITICAL ENTITIES TO CHECK (each must be present or clearly represented):
{entity_list}

CRITICAL INVARIANTS TO CHECK (each must be preserved or clearly implied):
{invariant_list}

INSTRUCTIONS:
For EACH critical entity and EACH critical invariant, determine:
  - PRESENT: The concept is clearly represented in the output
  - PARTIAL: The concept is vaguely implied but incomplete
  - MISSING: The concept is entirely absent

Return your assessment as valid JSON only (no markdown fences), with this exact structure:
{{
  "entities": {{
    "<entity_name>": {{"status": "PRESENT|PARTIAL|MISSING", "evidence": "<10 words max>"}},
    ...
  }},
  "invariants": {{
    "<invariant_description>": {{"status": "PRESENT|PARTIAL|MISSING", "evidence": "<10 words max>"}},
    ...
  }},
  "overall_retention_score": <float 0.0 to 1.0>,
  "notes": "<one sentence>"
}}"""

    resp = llm.create_chat_completion(
        messages=[{"role": "user", "content": judge_prompt}],
        temperature=0.1,
        max_tokens=4096,
    )
    raw = resp["choices"][0]["message"]["content"].strip()

    # Try to parse JSON, handling markdown fences
    cleaned = raw
    # Strip markdown code fences (may be nested)
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)

    # Try direct parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try to extract JSON object by finding first { and last }
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        try:
            return json.loads(cleaned[first_brace:last_brace + 1])
        except json.JSONDecodeError:
            pass

    # Fallback: extract status values from truncated JSON using regex
    import re
    status_pattern = re.compile(r'"status"\s*:\s*"(PRESENT|PARTIAL|MISSING)"')
    evidence_pattern = re.compile(r'"([^"]+)"\s*:\s*\{\s*"status"\s*:\s*"(PRESENT|PARTIAL|MISSING)"')
    
    matches = evidence_pattern.findall(cleaned)
    if matches:
        print(f"\n    [INFO] Repaired truncated JSON: found {len(matches)} graded items via regex")
        # Reconstruct from regex matches
        entities = {}
        invariants = {}
        entity_names = [e.lower() for e in critical_entities]
        invariant_names = [i.lower() for i in critical_invariants]
        
        for name, status in matches:
            name_lower = name.lower()
            # Classify as entity or invariant based on our known lists
            is_entity = any(name_lower in en or en in name_lower for en in entity_names)
            is_invariant = any(name_lower in inv or inv in name_lower for inv in invariant_names)
            
            entry = {"status": status, "evidence": "(extracted from truncated response)"}
            if is_entity or (not is_invariant and len(entities) < len(critical_entities)):
                entities[name] = entry
            else:
                invariants[name] = entry
        
        return {
            "entities": entities,
            "invariants": invariants,
            "overall_retention_score": -1,
            "notes": "Reconstructed from truncated JSON via regex extraction",
            "repair_method": "regex",
        }

    # Log the failed parse for debugging
    print(f"\n    [WARN] Failed to parse judge JSON. Raw response preview:")
    print(f"    {raw[:300]}")

    return {
        "parse_error": True,
        "raw_response": raw[:500],
        "entities": {},
        "invariants": {},
        "overall_retention_score": -1,
        "notes": "Failed to parse judge response as JSON",
    }


def audit_target(target_id: str, llm: CloudLLMClient) -> dict:
    """Run the full audit pipeline for one target."""
    cfg = AUDIT_TARGETS[target_id]
    print("\n" + "="*70)
    print(f"  AUDITING: {target_id} (domain={cfg['domain']})")
    print("="*70)

    # 1. Load source
    source = load_source(target_id)
    print(f"  Source loaded: {len(source)} chars, {len(source.splitlines())} lines")

    # 2. Run Stage 1
    print(f"  Running Stage 1 (schema extraction)...", end=" ", flush=True)
    t0 = time.time()
    schema = run_stage1(llm, source, cfg["domain"])
    t1 = time.time()
    print(f"done ({t1-t0:.1f}s, {len(schema)} chars)")

    # 3. Grade Stage 1
    print(f"  Grading Stage 1 extraction...", end=" ", flush=True)
    s1_grade = grade_extraction(
        llm,
        "Stage 1 Schema",
        source,
        schema,
        cfg["critical_entities"],
        cfg["critical_invariants"],
    )
    t2 = time.time()
    print(f"done ({t2-t1:.1f}s)")

    # 4. Run Stage 2
    print(f"  Running Stage 2 (synthesis)...", end=" ", flush=True)
    synthesized = run_stage2(llm, schema, cfg["domain"])
    t3 = time.time()
    print(f"done ({t3-t2:.1f}s, {len(synthesized)} chars)")

    # 5. Grade Stage 2
    print(f"  Grading Stage 2 retention...", end=" ", flush=True)
    s2_grade = grade_extraction(
        llm,
        "Stage 2 Synthesized Code",
        source,
        synthesized,
        cfg["critical_entities"],
        cfg["critical_invariants"],
    )
    t4 = time.time()
    print(f"done ({t4-t3:.1f}s)")

    # 6. Syntax check on Stage 2 output
    syntax_valid, syntax_errors = validate_syntax(synthesized, cfg["domain"])

    # 7. Compute summary stats
    s1_statuses = [v.get("status", "MISSING") for v in s1_grade.get("entities", {}).values()]
    s1_statuses += [v.get("status", "MISSING") for v in s1_grade.get("invariants", {}).values()]
    s2_statuses = [v.get("status", "MISSING") for v in s2_grade.get("entities", {}).values()]
    s2_statuses += [v.get("status", "MISSING") for v in s2_grade.get("invariants", {}).values()]

    def score(statuses):
        if not statuses:
            return 0.0
        pts = sum(1.0 if s == "PRESENT" else 0.5 if s == "PARTIAL" else 0.0 for s in statuses)
        return round(pts / len(statuses), 3)

    result = {
        "target_id": target_id,
        "domain": cfg["domain"],
        "source_chars": len(source),
        "source_lines": len(source.splitlines()),
        "schema_chars": len(schema),
        "synthesized_chars": len(synthesized),
        "stage1": {
            "schema_preview": schema[:500],
            "grade": s1_grade,
            "retention_score": s1_grade.get("overall_retention_score", score(s1_statuses)),
            "computed_score": score(s1_statuses),
        },
        "stage2": {
            "output_preview": synthesized[:500],
            "grade": s2_grade,
            "retention_score": s2_grade.get("overall_retention_score", score(s2_statuses)),
            "computed_score": score(s2_statuses),
            "syntax_valid": syntax_valid,
            "syntax_errors": syntax_errors,
        },
        "information_bottleneck": {
            "compression_ratio": round(1.0 - len(schema) / max(len(source), 1), 3),
            "stage1_to_stage2_drop": round(
                score(s1_statuses) - score(s2_statuses), 3
            ) if s1_statuses and s2_statuses else None,
        },
        "timing": {
            "stage1_sec": round(t1 - t0, 2),
            "stage2_sec": round(t3 - t2, 2),
            "total_sec": round(t4 - t0, 2),
        },
    }

    # Print summary
    print(f"\n  -- Results for {target_id} --")
    print(f"  Stage 1 retention: {result['stage1']['computed_score']:.0%}")
    print(f"  Stage 2 retention: {result['stage2']['computed_score']:.0%}")
    print(f"  Info bottleneck drop: {result['information_bottleneck']['stage1_to_stage2_drop']}")
    print(f"  Compression ratio: {result['information_bottleneck']['compression_ratio']:.1%}")
    print(f"  Syntax valid: {syntax_valid}")
    if syntax_errors:
        print(f"  Syntax errors: {syntax_errors[:3]}")

    return result


def main():
    parser = argparse.ArgumentParser(description="Audit Deanchor 2-Stage Protocol")
    parser.add_argument("--target", type=str, help="Run audit on a single target ID")
    parser.add_argument("--all", action="store_true", help="Run all 5 domain targets")
    parser.add_argument("--output", type=str, default=None, help="Output JSON path")
    args = parser.parse_args()

    # Select targets
    if args.target:
        if args.target not in AUDIT_TARGETS:
            print(f"ERROR: Unknown target '{args.target}'")
            print(f"Available: {list(AUDIT_TARGETS.keys())}")
            sys.exit(1)
        targets = [args.target]
    elif args.all:
        targets = list(AUDIT_TARGETS.keys())
    else:
        # Default: run all 5
        targets = list(AUDIT_TARGETS.keys())

    # Initialize LLM
    provider, base_url, api_key, model_id = get_default_provider_and_model()
    print(f"Provider: {provider} | Model: {model_id}")
    if not api_key:
        print("ERROR: No API key found. Set GEMINI_API_KEY or OPENROUTER_API_KEY in .env")
        sys.exit(1)

    llm = CloudLLMClient(base_url=base_url, api_key=api_key, model_id=model_id)

    # Run audits
    all_results = []
    for tid in targets:
        try:
            result = audit_target(tid, llm)
            all_results.append(result)
        except Exception as e:
            print(f"\n  ERROR on {tid}: {e}")
            all_results.append({"target_id": tid, "error": str(e)})

    # Summary table
    print("\n\n" + "="*70)
    print("  AUDIT SUMMARY")
    print("="*70)
    print(f"  {'Target':<30} {'S1 Score':>10} {'S2 Score':>10} {'Drop':>8} {'Syntax':>8}")
    print(f"  {'-'*30} {'-'*10} {'-'*10} {'-'*8} {'-'*8}")
    for r in all_results:
        if "error" in r:
            print(f"  {r['target_id']:<30} {'ERROR':>10}  {r.get('error','')[:40]}")
            continue
        s1 = r["stage1"]["computed_score"]
        s2 = r["stage2"]["computed_score"]
        drop = r["information_bottleneck"]["stage1_to_stage2_drop"]
        drop_str = f"{drop:>+7.0%}" if drop is not None else "    N/A"
        syn = "Y" if r["stage2"]["syntax_valid"] else "N"
        print(f"  {r['target_id']:<30} {s1:>9.0%} {s2:>9.0%} {drop_str:>8} {syn:>8}")

    # Save results
    out_path = args.output or str(ROOT / "results" / "stage_audit_results.json")
    pathlib.Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"\n  Results saved to: {out_path}")


if __name__ == "__main__":
    main()
