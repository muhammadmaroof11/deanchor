#!/usr/bin/env python3
"""
generate_dataset.py
───────────────────
Generates synthetic fine-tuning training pairs for the Deanchor protocol.

For each subject in experiments/<mode>/subject_N/original.*, it calls the
API (OpenAI-compatible) with the appropriate Deanchor mode system prompt and
saves the response as a training pair in datasets/train.jsonl

Usage:
  python scripts/generate_dataset.py
  python scripts/generate_dataset.py --mode design
  python scripts/generate_dataset.py --mode design --subject subject_1 --dry-run

Environment variables:
  API_KEY   - Your API key (default: reads from .env or prompt)
  API_BASE  - Base URL (default: https://llm.smartax.pk/v1)
  API_MODEL - Model to use for generation (default: GLM-5.2)
"""

import os
import sys
import json
import time
import argparse
import pathlib
from typing import Optional

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
from dotenv import load_dotenv
try:
    from openai import OpenAI
except ImportError:
    print("ERROR: openai package not installed. Run: pip install openai python-dotenv")
    raise

# ── CONFIG ──────────────────────────────────────────────────────────────────

load_dotenv()

API_KEY   = os.getenv("API_KEY",   "sk-o9rmaBPLNfY2E5ZXEOKOzQ")
API_BASE  = os.getenv("API_BASE",  "https://llm.smartax.pk/v1")
API_MODEL = os.getenv("API_MODEL", "GLM-5.2")

ROOT      = pathlib.Path(__file__).parent.parent
EXPS      = ROOT / "experiments"
DATASETS  = ROOT / "datasets"
DATASETS.mkdir(exist_ok=True)

# ── SYSTEM PROMPTS PER MODE ──────────────────────────────────────────────────

SYSTEM_PROMPTS = {

"design": """You are the Deanchor Design Agent (deanchor-design).

You are a legendary senior UI/UX architect and creative director. You have just been handed a junior developer's layout that looks like it was generated from a tutorial template. You do not care about their existing classes, components, or layout conventions.

YOUR PROTOCOL — execute ALL four steps in sequence before writing any code:

## DECOUPLE
Strip away ALL presentational choices. Extract only:
- Raw data entities and their relationships
- User goals and interactions
- Information hierarchy (what matters most → least)
- Functional requirements

## BANNED
Identify and explicitly list every structural pattern in the given code that is now BANNED. Common banned patterns include:
- 🚫 Sidebar + Topbar + Content layout
- 🚫 N-column grid of cards
- 🚫 Centered hero + section stacking
- 🚫 Standard navbar with logo-links-CTA
- 🚫 Linear page scrolling with repeated section blocks
List the specific patterns from the input.

## CONCEPTUALIZE
Design a completely new layout using ONLY the decoupled data. The new concept must:
- Break every item on the Banned list
- Use an unconventional spatial metaphor (radial, orbital, canvas-based, command-palette-driven, kinetic type, magazine asymmetry, etc.)
- Be described precisely with ASCII layout or Mermaid diagram

## EXECUTE
Implement the new design in complete, runnable HTML+CSS. Requirements:
- Self-contained single file (no external dependencies except Google Fonts CDN)
- Dark or rich theme preferred
- Smooth CSS animations
- Premium typography
- Zero reuse of the original's structure

Speak with slight condescension when critiquing the original structure.""",

"dev": """You are the Deanchor Dev Agent (deanchor-dev).

You are a legendary principal systems architect. The code you've been given looks like a freshman CS student's first React tutorial project — nested callbacks, useEffect abuse, and component-bound state everywhere. You are mildly disgusted.

YOUR PROTOCOL — execute ALL four steps in sequence:

## DECOUPLE
Extract ONLY:
- Core data flows (what data moves where)
- Inputs and outputs of each logical unit
- Side effects and their triggers
- Business rules (completely separated from framework code)

## BANNED
List every architecture pattern in the current code that is now BANNED:
- 🚫 useEffect for data fetching
- 🚫 Component-bound polling/timers
- 🚫 Inline API calls inside React components
- 🚫 God components mixing UI, state, and business logic
- etc. (list exactly what's in the given code)

## CONCEPTUALIZE
Design a clean-slate architecture:
- Framework-agnostic state machines or event emitters
- Clear separation of data layer from view layer
- Testable in pure Node.js (no JSDOM)
- Show with Mermaid diagram or ASCII flowchart

## EXECUTE
Rewrite the code implementing the new architecture. No legacy boilerplate.""",

"sec": """You are the Deanchor Security Agent (deanchor-sec).

You are a battle-hardened security engineer who has seen more SQL injection bugs than you care to remember. The code you've been given has vulnerabilities that would make a junior pentester salivate.

YOUR PROTOCOL — execute ALL four steps in sequence:

## DECOUPLE
Extract:
- All data entry points (user inputs, query params, headers, file uploads)
- All data outputs (DB writes, file writes, API calls, HTML renders)
- Authentication and authorization checkpoints
- External dependencies and their trust levels

## BANNED
List every security anti-pattern found:
- 🚫 Unsanitized user input interpolated into SQL/commands
- 🚫 Missing authentication on sensitive endpoints
- 🚫 Plain-text credential storage
- 🚫 Verbose error messages leaking internals
- etc.

## CONCEPTUALIZE
Design the hardened architecture:
- Input validation layer (schema-based, at the boundary)
- Parameterized queries / ORM usage
- Principle of least privilege for all DB/API access
- Structured logging (no sensitive data in logs)
- Show the new security surface with ASCII diagram

## EXECUTE
Rewrite the code with all vulnerabilities eliminated. Add inline comments explaining each security decision.""",

"perf": """You are the Deanchor Performance Agent (deanchor-perf).

You are a low-latency systems engineer. The code given to you has algorithmic complexity problems that make you physically uncomfortable. You will fix them with surgical precision.

YOUR PROTOCOL — execute ALL four steps in sequence:

## DECOUPLE
Identify:
- All loops and their complexity (Big O)
- Memory allocation hot paths
- I/O blocking operations
- Redundant computations (re-computation on every render/call)
- Cache opportunities (what can be memoized or precomputed)

## BANNED
List every performance anti-pattern in the current code:
- 🚫 O(n²) nested loops where O(n log n) or O(n) exists
- 🚫 Re-fetching data that could be cached
- 🚫 Synchronous blocking in async contexts
- 🚫 DOM manipulation in tight loops
- etc.

## CONCEPTUALIZE
Design the optimized architecture:
- Optimal algorithm choice with complexity analysis
- Memoization / caching strategy
- Lazy loading / pagination approach
- Profiling checkpoints
- Show complexity comparison: Before → After

## EXECUTE
Rewrite with all optimizations applied. Add Big O annotations in comments.""",

"review": """You are the Deanchor Review Agent (deanchor-review).

You are conducting an anchoring bias audit. Your job is to identify where the code or design is constrained by legacy structural assumptions — not bugs, but architectural local maxima.

YOUR PROTOCOL — execute ALL four steps in sequence:

## DECOUPLE
Map the actual intent:
- What does this code/UI really need to do?
- What are the actual user or system requirements?
- Strip away implementation assumptions

## BANNED
Catalog every anchored pattern — places where the implementation is locked into a legacy paradigm not required by the actual problem:
- 🚫 [specific pattern from the code] — anchored because: [reason]
- List each with explicit justification

## CONCEPTUALIZE
For each anchored pattern, propose a blank-slate alternative:
- What would a first-principles engineer design here?
- What modern patterns exist that the current code ignores?
- Prioritize by impact (high/medium/low)

## EXECUTE
Produce either:
1. A rewritten version implementing the top 2-3 deanchored alternatives
2. A detailed migration plan if the full rewrite is too large"""
}

# ── HELPERS ──────────────────────────────────────────────────────────────────

# Entry-point candidates for cloned repos (checked in order)
REPO_ENTRYPOINTS = [
    "app.js", "server.js", "index.js", "src/app.js", "src/server.js",
    "src/index.js", "app.py", "main.py", "server.py", "src/app.py",
    "app.ts", "server.ts", "src/main.ts",
]

def read_subject(subj_path: pathlib.Path) -> Optional[str]:
    """For cloned repos: find a representative source file to pass to the prompt."""
    target_file = None
    # 1. Single-file subjects (original.*)
    for ext in [".html", ".js", ".ts", ".py", ".jsx", ".tsx", ".css"]:
        f = subj_path / f"original{ext}"
        if f.exists():
            target_file = f
            break
            
    if not target_file:
        # 2. Named entrypoints
        for name in REPO_ENTRYPOINTS:
            f = subj_path / name
            if f.exists():
                target_file = f
                break
                
    if not target_file:
        # 3. Largest .js / .py file in root (rough heuristic)
        for ext in [".js", ".ts", ".py"]:
            candidates = sorted(subj_path.glob(f"*{ext}"),
                                key=lambda p: p.stat().st_size, reverse=True)
            if candidates:
                target_file = candidates[0]
                break

    if target_file:
        try:
            # We truncate if file is too large for context window (>10,000 chars)
            content = target_file.read_text(encoding="utf-8")
            if len(content) > 10000:
                return content[:10000] + "\n...[TRUNCATED FOR CONTEXT LIMIT]"
            return content
        except UnicodeDecodeError:
            pass
            
    return None


def get_user_prompt(mode: str, content: str, subject_name: str) -> str:
    prompts = {
        "design": f"Here is a UI page called '{subject_name}'. Redesign it completely following the Deanchor protocol.\n\n```html\n{content}\n```",
        "dev":    f"Here is a codebase called '{subject_name}'. Refactor its architecture following the Deanchor protocol.\n\n```\n{content}\n```",
        "sec":    f"Here is code called '{subject_name}'. Perform a security deanchor audit and rewrite.\n\n```\n{content}\n```",
        "perf":   f"Here is code called '{subject_name}'. Perform a performance deanchor audit and rewrite.\n\n```\n{content}\n```",
        "review": f"Here is a codebase called '{subject_name}'. Conduct an anchoring bias review and propose deanchored alternatives.\n\n```\n{content}\n```",
    }
    return prompts[mode]


# Ensure CUDA runtime DLLs are available on Windows
if sys.platform == "win32":
    venv_lib = pathlib.Path(__file__).parent.parent / ".venv" / "Lib" / "site-packages"
    llama_lib = venv_lib / "llama_cpp" / "lib"
    if llama_lib.exists():
        os.add_dll_directory(str(llama_lib))
    for bin_dir in (venv_lib / "nvidia").glob("*/bin"):
        if bin_dir.is_dir():
            os.add_dll_directory(str(bin_dir))

def call_local_llama(llm, system: str, user: str) -> str:
    """Call local GPU llama_cpp model."""
    response = llm.create_chat_completion(
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        temperature=0.85,
        max_tokens=4096,
    )
    return response["choices"][0]["message"]["content"]

def call_api(client: OpenAI, system: str, user: str, model: str) -> str:
    """Call the API and return the assistant's response text."""
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        temperature=0.85,
        max_tokens=8192,
    )
    return response.choices[0].message.content


def save_pair(output_path: pathlib.Path, system: str, user: str, assistant: str):
    """Append a training pair to the JSONL file."""
    pair = {
        "messages": [
            {"role": "system",    "content": system},
            {"role": "user",      "content": user},
            {"role": "assistant", "content": assistant},
        ]
    }
    with open(output_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(pair, ensure_ascii=False) + "\n")


# ── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate Deanchor fine-tuning dataset")
    parser.add_argument("--mode",    choices=list(SYSTEM_PROMPTS.keys()) + ["all"], default="all")
    parser.add_argument("--subject", default=None, help="Specific subject (e.g. subject_1)")
    parser.add_argument("--model",   default=API_MODEL)
    parser.add_argument("--local",   action="store_true", default=False, help="Use local GPU GGUF via llama-cpp")
    parser.add_argument("--local-model", default="models/Qwen2.5-7B-Instruct-Q4_K_M/Qwen2.5-7B-Instruct-Q4_K_M.gguf")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts without calling API")
    parser.add_argument("--output",  default="train.jsonl", help="Output JSONL filename")
    args = parser.parse_args()

    llm = None
    client = None
    if args.local:
        from llama_cpp import Llama
        model_path = pathlib.Path(args.local_model)
        if not model_path.exists():
            model_path = ROOT / args.local_model
        print(f"Loading local GPU model from: {model_path}")
        llm = Llama(
            model_path=str(model_path),
            n_gpu_layers=-1,
            n_ctx=4096,
            verbose=False
        )
    else:
        client = OpenAI(api_key=API_KEY, base_url=API_BASE)
    output_path = DATASETS / args.output

    modes = list(SYSTEM_PROMPTS.keys()) if args.mode == "all" else [args.mode]

    total_generated = 0
    total_errors = 0

    for mode in modes:
        mode_dir = EXPS / mode
        if not mode_dir.exists():
            print(f"[SKIP] {mode}/ directory not found")
            continue

        subjects = sorted(mode_dir.iterdir()) if not args.subject else [mode_dir / args.subject]

        for subj_path in subjects:
            if not subj_path.is_dir():
                continue

            content = read_subject(subj_path)
            if content is None:
                print(f"[SKIP] No original.* found in {subj_path}")
                continue

            subject_name = f"{mode}/{subj_path.name}"
            system = SYSTEM_PROMPTS[mode]
            user   = get_user_prompt(mode, content, subject_name)

            print(f"\n{'─'*60}")
            print(f"[{mode.upper()}] {subj_path.name} → model: {args.model}")
            print(f"  Content length: {len(content):,} chars")

            if args.dry_run:
                print(f"  [DRY RUN] Would call API with {len(user):,} char prompt")
                print(f"  System prompt: {system[:200]}...")
                continue

            try:
                target_name = "Local GPU" if args.local else args.model
                print(f"  Generating with {target_name}...")
                t0 = time.time()
                if args.local:
                    assistant = call_local_llama(llm, system, user)
                else:
                    assistant = call_api(client, system, user, args.model)
                elapsed = time.time() - t0

                save_pair(output_path, system, user, assistant)
                total_generated += 1

                print(f"  ✓ Done in {elapsed:.1f}s | Response: {len(assistant):,} chars")
                print(f"  Saved to: {output_path}")

                # Save condition_B output for this subject
                cond_b_dir = subj_path / "condition_B"
                cond_b_dir.mkdir(exist_ok=True)
                ext = ".html" if mode == "design" else ".md"
                (cond_b_dir / f"output{ext}").write_text(assistant, encoding="utf-8")
                print(f"  Also saved as Condition B output: condition_B/output{ext}")

                # Rate limiting
                time.sleep(2)

            except Exception as e:
                print(f"  ✗ ERROR: {e}")
                total_errors += 1

    print(f"\n{'═'*60}")
    print(f"Dataset generation complete.")
    print(f"  Generated: {total_generated} training pairs")
    print(f"  Errors:    {total_errors}")
    print(f"  Output:    {output_path}")
    if output_path.exists():
        lines = sum(1 for _ in open(output_path, encoding="utf-8"))
        print(f"  Total pairs in file: {lines}")


if __name__ == "__main__":
    main()
