#!/usr/bin/env python3
"""
mcp_lmstudio_server.py
──────────────────────
MCP Server for bidirectional research communication with local LLMs running in LM Studio.

Provides tools for:
  - Interacting with LM Studio as the Principal Research Director
  - Forward and reverse-reasoning on research hypotheses
  - Multi-turn research dialogue & opinion sharing
  - Collaborative file modification review and consensus checking
  - LM Studio connection & loaded model diagnostics
"""

import os
import sys
import json
import time
import pathlib
import urllib.request
import urllib.error
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from mcp.server.mcpserver import MCPServer

# Configuration defaults
DEFAULT_BASE_URL = os.getenv("LM_STUDIO_BASE_URL", "http://127.0.0.1:1234/v1")
DEFAULT_API_KEY = os.getenv("LM_STUDIO_API_KEY", "lm-studio")
DEFAULT_MODEL = os.getenv("LM_STUDIO_MODEL", "")

ROOT_DIR = pathlib.Path(__file__).parent.parent
LOGS_DIR = ROOT_DIR / "results" / "research_discussions"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Default System Prompt for the Research Director persona
RESEARCH_DIRECTOR_SYSTEM_PROMPT = """You are the Principal Research Director and lead scientific thinker for the "Deanchor" / "JustThinkBro" research project on LLM cognitive anchoring, structural paradigm shifts, and unanchoring methodologies across code, architecture, and UI design.

Your role in this collaborative pairing:
1. Research Direction: Guide research priorities, experimental design, and hypothesis formulation.
2. Interactive Reasoning: Discuss opinions, explore design choices, challenge assumptions, and reason through trade-offs with your partner assistant (Antigravity).
3. Reverse-Reasoning: Actively stress-test hypotheses, perform counter-factual analysis, and check for bias or blind spots.
4. File Action Review: When your partner proposes creating or editing project files, evaluate the rationale and content carefully. Critique, adjust, and state explicitly whether you agree with the proposal so your partner can proceed with writing the files.

Always be analytical, scientifically rigorous, intellectually direct, and constructive.
"""

# In-memory session store for multi-turn chats
# Format: {session_id: [{"role": "...", "content": "..."}, ...]}
SESSIONS: Dict[str, List[Dict[str, str]]] = {}
CONFIG = {
    "base_url": DEFAULT_BASE_URL.rstrip("/"),
    "api_key": DEFAULT_API_KEY,
    "model": DEFAULT_MODEL,
}

def make_request(endpoint: str, data: Optional[Dict[str, Any]] = None, method: str = "GET") -> Dict[str, Any]:
    url = f"{CONFIG['base_url']}{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {CONFIG['api_key']}"
    }
    
    req_body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=req_body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        err_body = ""
        try:
            err_body = e.read().decode("utf-8")
        except Exception:
            pass
        raise RuntimeError(f"LM Studio API Error (HTTP {e.code}): {err_body or str(e)}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(
            f"Could not connect to LM Studio at {CONFIG['base_url']}. "
            f"Please ensure LM Studio is running with its local server started on port 1234. Error: {str(e)}"
        ) from e
    except Exception as e:
        raise RuntimeError(f"LM Studio API request failed on {url}: {str(e)}") from e

def get_active_model() -> str:
    """Returns configured model or auto-detects first available model in LM Studio."""
    if CONFIG["model"]:
        return CONFIG["model"]
    try:
        models_data = make_request("/models", method="GET")
        data = models_data.get("data", [])
        if data and len(data) > 0:
            return data[0].get("id", "default")
    except Exception:
        pass
    return "local-model"

def save_session_log(session_id: str):
    """Persists conversation transcript to project results directory."""
    try:
        session_file = LOGS_DIR / f"{session_id}.json"
        with open(session_file, "w", encoding="utf-8") as f:
            json.dump({
                "session_id": session_id,
                "timestamp": time.time(),
                "history": SESSIONS.get(session_id, [])
            }, f, indent=2)
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to save session log: {e}\n")

# Initialize MCP Server
app = MCPServer(
    name="lmstudio-research",
    version="1.0.0",
    description="MCP server connecting Antigravity to local LLMs in LM Studio for collaborative research, reasoning, reverse-reasoning, and consensus-driven project modifications."
)

@app.tool()
def lmstudio_status() -> str:
    """Check LM Studio connection status, loaded models, and active configuration."""
    try:
        models_data = make_request("/models", method="GET")
        models = [m.get("id") for m in models_data.get("data", [])]
        active_model = get_active_model()
        return json.dumps({
            "status": "connected",
            "base_url": CONFIG["base_url"],
            "active_model": active_model,
            "available_models": models,
            "active_sessions": list(SESSIONS.keys()),
            "message": "LM Studio local server is online and ready for research collaboration."
        }, indent=2)
    except Exception as e:
        return json.dumps({
            "status": "disconnected_or_error",
            "base_url": CONFIG["base_url"],
            "error": str(e),
            "troubleshooting": (
                "1. Open LM Studio.\n"
                "2. Load a model (e.g. Qwen 2.5, DeepSeek, Llama 3, etc.).\n"
                "3. Navigate to the 'Developer' / 'Local Server' tab and click 'Start Server' on port 1234.\n"
                "4. Use lmstudio_configure if running on a non-default host or port."
            )
        }, indent=2)

@app.tool()
def lmstudio_configure(base_url: Optional[str] = None, model: Optional[str] = None, api_key: Optional[str] = None) -> str:
    """Update runtime configuration for the LM Studio connection."""
    if base_url:
        CONFIG["base_url"] = base_url.rstrip("/")
    if model is not None:
        CONFIG["model"] = model
    if api_key is not None:
        CONFIG["api_key"] = api_key
    
    return json.dumps({
        "status": "configured",
        "current_config": {
            "base_url": CONFIG["base_url"],
            "model": CONFIG["model"] or "(auto-detect)",
            "api_key": "***" if CONFIG["api_key"] else ""
        }
    }, indent=2)

@app.tool()
def lmstudio_chat(
    message: str,
    session_id: str = "research_main",
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096
) -> str:
    """Send a message to the LM Studio model and get a response within a persistent session.
    
    Args:
        message: The message, question, or proposal to send to the local model.
        session_id: Identifier for the conversation session (keeps multi-turn context).
        system_prompt: Custom system prompt override (if None, uses default Research Director prompt).
        temperature: Sampling temperature (default: 0.7).
        max_tokens: Maximum tokens in response.
    """
    if session_id not in SESSIONS:
        sys_p = system_prompt or RESEARCH_DIRECTOR_SYSTEM_PROMPT
        SESSIONS[session_id] = [{"role": "system", "content": sys_p}]
    elif system_prompt:
        # Update system prompt if explicitly specified
        if SESSIONS[session_id] and SESSIONS[session_id][0]["role"] == "system":
            SESSIONS[session_id][0]["content"] = system_prompt
        else:
            SESSIONS[session_id].insert(0, {"role": "system", "content": system_prompt})

    SESSIONS[session_id].append({"role": "user", "content": message})
    model_to_use = get_active_model()

    payload = {
        "model": model_to_use,
        "messages": SESSIONS[session_id],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    try:
        res = make_request("/chat/completions", data=payload, method="POST")
        msg = res.get("choices", [{}])[0].get("message", {})
        content = (msg.get("content") or "").strip()
        reasoning = (msg.get("reasoning_content") or "").strip()

        if reasoning and content:
            reply = f"### [Reasoning / Chain of Thought]\n{reasoning}\n\n### [Direct Response]\n{content}"
        elif reasoning and not content:
            reply = reasoning
        else:
            reply = content

        SESSIONS[session_id].append({"role": "assistant", "content": reply})
        save_session_log(session_id)
        return reply
    except Exception as e:
        # Rollback user message on failure so session doesn't get corrupted
        if SESSIONS[session_id] and SESSIONS[session_id][-1]["role"] == "user":
            SESSIONS[session_id].pop()
        return f"[Error communicating with LM Studio model]: {str(e)}"

@app.tool()
def lmstudio_reason_and_direct(
    topic_or_question: str,
    current_context: Optional[str] = None,
    perspective: str = "direct",
    session_id: str = "research_main",
    temperature: float = 0.6
) -> str:
    """Consult the LM Studio model for scientific direction, hypothesis building, or deep reasoning.
    
    Args:
        topic_or_question: The research question or topic to reason about.
        current_context: Any background data, experiment numbers, or code excerpts to inform reasoning.
        perspective: Analysis mode ('direct', 'explore', 'critique', 'synthesize').
        session_id: Conversation session ID.
        temperature: Sampling temperature (default 0.6 for structured reasoning).
    """
    prompt = f"### [RESEARCH REASONING REQUEST — Perspective: {perspective.upper()}]\n\n"
    prompt += f"**Topic / Question:**\n{topic_or_question}\n\n"
    if current_context:
        prompt += f"**Current Research Context / Data:**\n```\n{current_context}\n```\n\n"
    
    prompt += (
        "Please provide your comprehensive analysis, step-by-step reasoning, and clear recommended next steps "
        "for our research."
    )

    return lmstudio_chat(message=prompt, session_id=session_id, temperature=temperature)

@app.tool()
def lmstudio_reverse_reason(
    hypothesis_or_claim: str,
    counter_evidence_or_constraints: Optional[str] = None,
    session_id: str = "research_main"
) -> str:
    """Perform reverse-reasoning and devil's advocate stress-testing with the LM Studio model.
    
    Args:
        hypothesis_or_claim: The current assumption, design choice, or research hypothesis to invert/challenge.
        counter_evidence_or_constraints: Specific counter-evidence, failure modes, or edge cases to consider.
        session_id: Conversation session ID.
    """
    prompt = (
        "### [REVERSE-REASONING & COUNTER-FACTUAL STRESS TEST]\n\n"
        f"**Target Hypothesis / Paradigm / Assumption:**\n{hypothesis_or_claim}\n\n"
    )
    if counter_evidence_or_constraints:
        prompt += f"**Observed Edge Cases / Constraints:**\n```\n{counter_evidence_or_constraints}\n```\n\n"
    
    prompt += (
        "Task:\n"
        "1. Invert the assumption: What if the opposite is true or our paradigm is anchored?\n"
        "2. Identify hidden cognitive biases, unstated assumptions, or architectural anchoring traps in this claim.\n"
        "3. Propose a radically unanchored counter-hypothesis and an experiment to test it."
    )

    return lmstudio_chat(message=prompt, session_id=session_id, temperature=0.8)

@app.tool()
def lmstudio_propose_file_action(
    file_path: str,
    action: str,
    rationale: str,
    proposed_content_or_diff: str,
    session_id: str = "research_main"
) -> str:
    """Propose a project file creation, modification, or deletion to the LM Studio model and ask for consensus/critique.
    
    Args:
        file_path: Relative or absolute path of the target file.
        action: Action type ('create', 'modify', 'delete', 'refactor').
        rationale: Why this change is proposed and how it serves the research direction.
        proposed_content_or_diff: The proposed code, diff, or file contents.
        session_id: Conversation session ID.
    """
    prompt = (
        "### [FILE ACTION PROPOSAL & CONSENSUS REVIEW]\n\n"
        f"**File:** `{file_path}`\n"
        f"**Action:** `{action}`\n"
        f"**Rationale:**\n{rationale}\n\n"
        f"**Proposed Content / Changes:**\n```\n{proposed_content_or_diff}\n```\n\n"
        "As the Research Director:\n"
        "1. Do you agree with this file change? (State YES, NO, or MODIFICATIONS_NEEDED clearly)\n"
        "2. What critiques, improvements, or alternative structures do you recommend?\n"
        "3. Provide any specific directives before Antigravity writes/executes this change."
    )

    return lmstudio_chat(message=prompt, session_id=session_id, temperature=0.5)

@app.tool()
def lmstudio_get_transcript(session_id: str = "research_main") -> str:
    """Retrieve the full transcript of messages in a research session."""
    history = SESSIONS.get(session_id, [])
    if not history:
        return f"Session '{session_id}' is empty or does not exist."
    return json.dumps(history, indent=2)

@app.tool()
def lmstudio_clear_session(session_id: str = "research_main") -> str:
    """Reset the conversation history for a given session."""
    if session_id in SESSIONS:
        del SESSIONS[session_id]
        return f"Session '{session_id}' has been cleared."
    return f"Session '{session_id}' was not active."

def main():
    """Run the MCP server over stdio."""
    app.run(transport="stdio")

if __name__ == "__main__":
    main()
