"""
CLI Interface for Deanchor Engine.
"""

import sys
import pathlib
import argparse
from .engine import DeanchorEngine, detect_niche
from .models import AVAILABLE_PRESETS

# Ensure clean UTF-8 output on Windows
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def format_header():
    return """
╔══════════════════════════════════════════════════════════════════════╗
║               🌌 DEANCHOR ENGINE — CLI v1.0.0                       ║
║        Blank-Slate Context Decoupling for AI Code & UI Synthesis     ║
╚══════════════════════════════════════════════════════════════════════╝
"""


def main():
    parser = argparse.ArgumentParser(
        prog="deanchor",
        description="Deanchor Engine: Transform anchored legacy code/UI into clean-slate architectures via Two-Stage Decoupling."
    )
    parser.add_argument("input_file", help="Path to input code or UI file (e.g. index.html, server.js, orderbook.ts)")
    parser.add_argument("-n", "--niche", choices=["auto", "design", "dev", "sec", "perf"], default="auto",
                        help="Domain niche for specialized decoupling rules (default: auto)")
    parser.add_argument("-m", "--model", default="auto",
                        help=f"Model preset ({', '.join(AVAILABLE_PRESETS.keys())}) or custom path (default: auto)")
    parser.add_argument("-o", "--output", default=None,
                        help="Path to save synthesized output file (default: print to stdout / auto-name)")
    parser.add_argument("--save-schema", default=None,
                        help="Optional path to save intermediate Stage 1 YAML schema")
    parser.add_argument("--ctx", type=int, default=8192,
                        help="Context window size (default: 8192)")
    parser.add_argument("-t", "--temperature", type=float, default=0.85,
                        help="Sampling temperature for Stage 2 synthesis (default: 0.85)")
    parser.add_argument("-q", "--quiet", action="store_true",
                        help="Suppress progress banners and emit only raw output")
    args = parser.parse_args()

    input_path = pathlib.Path(args.input_file)
    if not input_path.is_file():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    content = input_path.read_text(encoding="utf-8", errors="ignore")
    niche = detect_niche(input_path, args.niche)

    if not args.quiet:
        print(format_header())
        print(f"📁 Target File : {input_path.name} ({len(content):,} chars)")
        print(f"🎯 Target Niche: {niche.upper()}")
        print(f"🤖 Model Engine: {args.model.upper()}")
        print(f"⚙️  Pipeline    : Stage 1 (Schema Extraction) ➔ Stage 2 (Clean Synthesis)")
        print(f"{'─'*70}")
        print("⏳ Initializing GPU engine & executing Stage 1...")

    engine = DeanchorEngine(model_identifier=args.model, n_ctx=args.ctx)

    try:
        result = engine.deanchor(content, niche=niche, temperature=args.temperature)
    except Exception as e:
        print(f"Execution Error: {e}", file=sys.stderr)
        sys.exit(1)

    metrics = result["metrics"]

    # Save optional schema
    if args.save_schema:
        schema_path = pathlib.Path(args.save_schema)
        schema_path.write_text(result["stage1_schema"], encoding="utf-8")
        if not args.quiet:
            print(f"📝 Intermediate schema saved to: {schema_path}")

    # Determine output destination
    output_code = result["stage2_output"]

    # Strip markdown code fencing if wrapping entire file
    lines = output_code.strip().splitlines()
    if len(lines) >= 2 and lines[0].startswith("```") and lines[-1].strip() == "```":
        output_code = "\n".join(lines[1:-1]).strip()

    if args.output:
        out_path = pathlib.Path(args.output)
        out_path.write_text(output_code, encoding="utf-8")
        if not args.quiet:
            print(f"✨ Synthesized clean-slate output saved to: {out_path}")
    else:
        # Default output file
        stem = input_path.stem
        ext = input_path.suffix if niche == "design" else ".md"
        out_path = input_path.parent / f"{stem}_deanchored{ext}"
        out_path.write_text(output_code, encoding="utf-8")
        if not args.quiet:
            print(f"✨ Synthesized clean-slate output saved to: {out_path}")

    if not args.quiet:
        syntax_status = "✅ Valid (0 Errors)" if metrics.get("syntax_valid", True) else f"⚠️ Warning ({len(metrics.get('syntax_errors', []))} Issues Detected)"
        print(f"{'─'*70}")
        print(f"📊 PERFORMANCE METRICS:")
        print(f"   • Stage 1 Extraction Time : {metrics['stage1_time_sec']}s")
        print(f"   • Stage 2 Synthesis Time  : {metrics['stage2_time_sec']}s")
        print(f"   • Total Pipeline Time     : {metrics['total_time_sec']}s")
        print(f"   • Token Noise Filtered    : {metrics['token_noise_reduction_pct']}% reduction")
        print(f"   • Synthesized Output Size : {metrics['output_chars']:,} chars")
        print(f"   • Syntax Integrity        : {syntax_status}")
        print(f"{'═'*70}\n")


if __name__ == "__main__":
    main()
