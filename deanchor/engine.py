"""
Core Two-Stage Decoupling Engine for Deanchor.
"""

import time
import pathlib
from typing import Dict, Any, Optional
from .prompts import STAGE1_SCHEMAS, STAGE2_PROMPTS
from .models import load_llm

try:
    from llama_cpp import Llama
except ImportError:
    Llama = None


def detect_niche(file_path: pathlib.Path, override_niche: Optional[str] = None) -> str:
    """Automatically detect domain niche from file extension or content."""
    if override_niche and override_niche.lower() != "auto":
        return override_niche.lower()

    ext = file_path.suffix.lower()
    name = file_path.stem.lower()

    if ext in [".html", ".htm", ".vue", ".jsx", ".tsx", ".css"]:
        return "design"
    if any(k in name for k in ["auth", "sec", "jwt", "login", "crypto"]):
        return "sec"
    if any(k in name for k in ["order", "book", "queue", "cache", "perf", "bench"]):
        return "perf"
    return "dev"


import html.parser
import ast

class DeanchorHTMLValidator(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.errors = []
        self.stack = []
        self.self_closing = {"img", "br", "hr", "input", "meta", "link", "source"}

    def handle_starttag(self, tag, attrs):
        if tag.lower() not in self.self_closing:
            self.stack.append(tag.lower())

    def handle_endtag(self, tag):
        tag_lower = tag.lower()
        if tag_lower in self.self_closing:
            return
        if self.stack and self.stack[-1] == tag_lower:
            self.stack.pop()
        elif tag_lower in self.stack:
            while self.stack and self.stack[-1] != tag_lower:
                unclosed = self.stack.pop()
                self.errors.append(f"Unclosed tag '<{unclosed}>' before '</{tag_lower}>'")
            if self.stack:
                self.stack.pop()
        else:
            self.errors.append(f"Unexpected end tag '</{tag_lower}>'")

    def close(self):
        super().close()
        for unclosed in self.stack:
            self.errors.append(f"Unclosed tag '<{unclosed}>' at end of document")


def validate_syntax(code: str, niche: str) -> tuple[bool, list[str]]:
    """Validate syntax integrity of synthesized code based on domain niche."""
    errors = []
    clean_code = code.strip()

    # Unwrap markdown code fence if wrapped
    lines = clean_code.splitlines()
    if len(lines) >= 2 and lines[0].startswith("```") and lines[-1].strip() == "```":
        clean_code = "\n".join(lines[1:-1]).strip()

    if not clean_code:
        return False, ["Output code is empty"]

    if niche == "design":
        validator = DeanchorHTMLValidator()
        try:
            validator.feed(clean_code)
            validator.close()
            errors.extend(validator.errors)
        except Exception as e:
            errors.append(f"HTML parsing exception: {e}")

    else:
        # Code validation: check bracket/brace balancing
        stack = []
        pairs = {')': '(', '}': '{', ']': '['}
        for idx, char in enumerate(clean_code):
            if char in pairs.values():
                stack.append((char, idx))
            elif char in pairs.keys():
                if not stack or stack[-1][0] != pairs[char]:
                    errors.append(f"Mismatched closing bracket '{char}' at character index {idx}")
                    break
                stack.pop()

        if stack:
            errors.append(f"Unclosed bracket '{stack[-1][0]}' at character index {stack[-1][1]}")

        # Python-specific AST check if code appears to be Python
        if "def " in clean_code or "import " in clean_code or "class " in clean_code:
            try:
                ast.parse(clean_code)
            except SyntaxError as se:
                # Only flag Python syntax error if code doesn't look like TS/JS
                if not any(k in clean_code for k in ["const ", "function ", "interface ", "type "]):
                    errors.append(f"Python SyntaxError: {se.msg} (line {se.lineno})")

    # Consider valid if 0 errors or <= 1 minor unclosed non-structural tag
    is_valid = len(errors) == 0
    return is_valid, errors


class DeanchorEngine:
    """Two-Stage Decoupling Engine for unanchored code and UI synthesis."""

    def __init__(self, model_identifier: str = "auto", n_ctx: int = 16384, gpu_layers: int = -1):
        self.model_identifier = model_identifier
        self.n_ctx = n_ctx
        self.gpu_layers = gpu_layers
        self.llm = None

    def initialize(self):
        if self.llm is None:
            self.llm = load_llm(
                model_identifier=self.model_identifier,
                n_ctx=self.n_ctx,
                n_gpu_layers=self.gpu_layers
            )

    def _infer(self, prompt: str, temperature: float = 0.85, max_tokens: int = 4096) -> str:
        res = self.llm.create_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=0.95,
            repeat_penalty=1.1
        )
        return res["choices"][0]["message"]["content"]

    def deanchor(
        self,
        content: str,
        niche: str = "design",
        temperature: float = 0.85,
        auto_repair: bool = True
    ) -> Dict[str, Any]:
        """Execute Two-Stage Decoupling pipeline on input code."""
        self.initialize()

        niche_key = niche if niche in STAGE1_SCHEMAS else "design"
        t0 = time.time()

        # Stage 1: In-Memory Semantic Entity & Intent Extraction
        s1_prompt_template = STAGE1_SCHEMAS[niche_key]
        s1_prompt = s1_prompt_template.format(content=content)
        t_s1_start = time.time()
        stage1_schema = self._infer(s1_prompt, temperature=0.3, max_tokens=2048)
        t_s1 = time.time() - t_s1_start

        # Stage 2: Blank-Slate Unanchored Synthesis
        s2_prompt_template = STAGE2_PROMPTS[niche_key]
        s2_prompt = s2_prompt_template.format(schema=stage1_schema)
        t_s2_start = time.time()
        stage2_output = self._infer(s2_prompt, temperature=temperature, max_tokens=4096)
        t_s2 = time.time() - t_s2_start

        # Syntax verification
        syntax_valid, syntax_errors = validate_syntax(stage2_output, niche_key)

        # Optional auto-repair pass if syntax verification failed
        if not syntax_valid and auto_repair:
            repair_prompt = f"""You are a code syntax repair engine.
Fix the following syntax/parsing errors in the provided code snippet while preserving all design and logic:

SYNTAX ERRORS TO FIX:
{chr(10).join('- ' + err for err in syntax_errors)}

CODE SNIPPET:
```
{stage2_output}
```

Return ONLY the complete, corrected code."""
            repaired_output = self._infer(repair_prompt, temperature=0.2, max_tokens=4096)
            repaired_valid, repaired_errors = validate_syntax(repaired_output, niche_key)
            if repaired_valid or len(repaired_errors) < len(syntax_errors):
                stage2_output = repaired_output
                syntax_valid = repaired_valid
                syntax_errors = repaired_errors

        total_time = time.time() - t0

        # Calculate noise compression stats
        orig_chars = len(content)
        schema_chars = len(stage1_schema)
        compression_ratio = round((1.0 - (schema_chars / max(orig_chars, 1))) * 100, 1)

        return {
            "niche": niche_key,
            "stage1_schema": stage1_schema,
            "stage2_output": stage2_output,
            "metrics": {
                "total_time_sec": round(total_time, 2),
                "stage1_time_sec": round(t_s1, 2),
                "stage2_time_sec": round(t_s2, 2),
                "original_chars": orig_chars,
                "schema_chars": schema_chars,
                "output_chars": len(stage2_output),
                "token_noise_reduction_pct": compression_ratio,
                "syntax_valid": syntax_valid,
                "syntax_errors": syntax_errors
            }
        }

