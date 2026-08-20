#!/usr/bin/env python3
"""
propose_condition_e.py
──────────────────────
Submits the Condition E Two-Stage Decoupled Inference proposal to the LM Studio Research Director for consensus.
"""

import sys
import pathlib

ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import scripts.mcp_lmstudio_server as mcp_srv

session = 'deanchor_solution_debate'

proposed_diff = """
### Addition to scripts/run_inference.py for Condition E (Structured Two-Stage Decoupled Inference):

STAGE1_DECOUPLE_PROMPT = \"\"\"You are a pure data and semantic intent extraction engine.
Task: Extract ONLY the raw facts, entities, user inputs, buttons/actions, and text copy from the provided file into a clean YAML schema.
STRICT RULE: Strip away and completely discard all HTML layout containers, CSS class names, styles, positioning, and visual structure.

```{ext}
{content}
```

Output format:
```yaml
page_title: ...
core_entities:
  - name: ...
    attributes: [...]
user_actions:
  - action_name: ...
    target: ...
raw_copy:
  - ...
```
\"\"\"

STAGE2_SYNTHESIS_PROMPT = \"\"\"You are an unanchored UI/Code architecture synthesis engine.
Task: Design a completely novel, state-of-the-art UI/architecture implementation from scratch using ONLY the provided content schema.
STRICT BANNED LIST:
- Do NOT use a traditional 3-column card grid.
- Do NOT use a standard left sidebar dashboard.
- Do NOT use generic centered hero sections with standard buttons.
- Create an orthogonal, innovative paradigm.

Extracted Content Schema:
```yaml
{schema}
```

Produce the complete, working implementation code.
\"\"\"

def run_condition_e(llm, content: str, ext: str = "html") -> dict:
    # Pass 1: Decouple content from presentation
    prompt1 = STAGE1_DECOUPLE_PROMPT.format(ext=ext, content=content)
    schema_res = run_inference(llm, prompt1, condition="E_stage1")
    
    # Pass 2: Clean-slate synthesis from decoupled schema
    prompt2 = STAGE2_SYNTHESIS_PROMPT.format(schema=schema_res)
    final_res = run_inference(llm, prompt2, condition="E_stage2")
    
    return {
        "decoupled_schema": schema_res,
        "final_output": final_res
    }
"""

print("Submitting Proposal to LM Studio Research Director for review...", flush=True)

review = mcp_srv.lmstudio_propose_file_action(
    file_path="scripts/run_inference.py",
    action="modify",
    rationale="Implement Condition E (Two-Stage Decoupled Inference) to solve contextual anchoring when history forking is unavailable. Pass 1 forces the attention mechanism to compress and distill only pure data/intent into YAML; Pass 2 synthesizes the unanchored UI solely from the clean YAML schema.",
    proposed_content_or_diff=proposed_diff,
    session_id=session
)

print("\n=== LM STUDIO RESEARCH DIRECTOR VERDICT & CRITIQUE ===")
print(review)
