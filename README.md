# Deanchor ⚓➡️🌌

An advanced agentic skill to break **contextual anchoring** (anchoring bias) in LLM-driven coding, design, and writing.

Like `ponytail` for simplicity, `deanchor` is a persistent mode and command suite designed to force AI agents (such as Antigravity, Claude Code, Codex, and Cursor) to escape "local maxima." It explicitly decouples the underlying data/facts from current presentation layers, bans legacy structural paradigms, and drafts new layout concepts before writing a single line of code.

---

## The Problem: Contextual Anchoring

When an AI coding agent is provided with existing code or UI structures, those tokens heavily weight the probability distribution of its subsequent outputs. The model is mathematically biased to optimize within the current structural paradigm—finding a **local maximum**—rather than executing a fundamental redesign from a blank slate.

This is a universal limitation across all current frontier models.

## The Solution: The Deanchor Protocol

`deanchor` enforces a strict, three-phase cognitive pipeline on the agent *before* any implementation begins:

```mermaid
graph TD
    A[Existing Code / UI / Prompt] --> B[1. DECOUPLE: Extract Pure Data & Facts]
    B --> C[2. BAN: List & Outlaw Current Paradigms]
    C --> D[3. CONCEPTUALIZE: Draft Clean-Slate Layouts]
    D --> E[4. EXECUTE: Write New Paradigm Code]
```

1. **DECOUPLE (Data Extraction):** Strip away all styling, class names, file structures, and control flows. Extract *only* the raw facts, user intents, inputs, and outputs into a clean markdown schema.
2. **BAN (Structural Prohibition):** Identify the existing architectural and visual paradigms and place them on a strict "Banned list." The agent is legally forbidden from reusing these structures.
3. **CONCEPTUALIZE (Blank-Slate Design):** Design a completely new layout or software architecture from scratch using the decoupled data and respecting the banned list.
4. **EXECUTE (Implementation):** Implement the approved clean-slate design. No copying of old boilerplate.

---

## Agent Persona & Execution Flow

Below is the detailed flow showing how the `deanchor` agent persona restores context, bypasses anchoring bias, and syncs updates to the project files:

### Sequence Diagram
```mermaid
sequenceDiagram
    autonumber
    actor User as Developer / User
    participant Agent as AI Coding Agent (Persona)
    participant Ledger as DEANCHOR.md (Cognitive Ledger)
    participant Graph as .graphify/ / repo-map.md (Index)
    participant Code as Active Codebase

    User->>Agent: Prompt/Request (e.g. "/deanchor-dev Rewrite routing")
    activate Agent

    Note over Agent: Workflow Auto-Triggered

    %% Step 1: Context Retrieval
    Agent->>Ledger: Scan & Read (Restore Ledger Context)
    Ledger-->>Agent: Data contracts, Banned List, Ascended Log
    Agent->>Graph: Map Blast Radius (MCP / repo-map.md)
    Graph-->>Agent: Code topology, cluster nodes, dependency path

    %% Step 2: Protocol Pipeline
    Note over Agent: Deanchor Protocol Execution
    Agent->>Agent: 1. Decouple (Filter raw data & intents from current files)
    Agent->>Agent: 2. Ban (Identify and prohibit current conventions/libraries)
    Agent->>Agent: 3. Conceptualize (Draft clean-slate, premium architectures)

    alt Level == Lite
        Agent->>User: Present 2 Design Concepts & Pause for Approval
        User-->>Agent: Select Concept / Approve
    else Level == Full (Default) or Ultra
        Note over Agent: Proceed directly to Execution
    end

    %% Step 3: Write and Update
    Agent->>Code: 4. Execute (Write clean-slate implementation)
    Agent->>Ledger: Update Redesign Log & Ascended backlogs
    Agent->>Graph: Rebuild knowledge graph (graphify update)
    
    deactivate Agent
    Agent-->>User: High-agency explanation of the Ascended architecture
```

### State Machine Transition
```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> RestoringContext : Trigger (Slash Command / Keyword Match)
    state RestoringContext {
        [*] --> ReadLedger
        ReadLedger --> QueryIndex : Read DEANCHOR.md
        QueryIndex --> [*] : Query MCP / repo-map.md
    }
    
    RestoringContext --> DeanchorProtocol : Context Restored
    state DeanchorProtocol {
        [*] --> DecoupleData
        DecoupleData --> BanParadigms : Extract facts
        BanParadigms --> Conceptualize : Define Prohibitions
        Conceptualize --> [*] : Design Blank-Slate UI/Architecture
    }

    DeanchorProtocol --> ExecutionMode : Concept Designed
    state ExecutionMode {
        [*] --> CheckLevel
        CheckLevel --> PauseForUser : Lite Mode
        PauseForUser --> WriteCode : User Approved
        CheckLevel --> WriteCode : Full / Ultra Mode
        WriteCode --> [*]
    }

    ExecutionMode --> PostSync : Code Implemented
    state PostSync {
        [*] --> UpdateLedger
        UpdateLedger --> RegenerateIndex : Log changes
        RegenerateIndex --> [*] : Rebuild graph & repomap
    }
    
    PostSync --> Idle : Completed
```

---

## Command Suite

| Command | Focus | Auto-Activation Triggers |
| :--- | :--- | :--- |
| `/deanchor` | **General Redesign** | `deanchor`, `unanchor`, `blank slate`, `tabula rasa`, `anchoring bias` |
| `/deanchor-dev` | **Software Architecture** | `redesign architecture`, `rewrite codebase`, `restructure files`, `deanchor-dev` |
| `/deanchor-design` | **UI/UX & Layouts** | `redesign page`, `visual revamp`, `new layout`, `deanchor-design` |
| `/deanchor-sec` | **Security Audit & CVEs** | `security audit`, `vulnerability check`, `secure alternative`, `deanchor-sec` |
| `/deanchor-doc` | **Documentation & Copy** | `rewrite docs`, `rewrite readmes`, `new voice`, `deanchor-doc` |
| `/deanchor-review` | **Anchoring Audit** | `review for anchoring`, `find anchored code`, `deanchor-review` |
| `/deanchor-help` | **Quick Reference** | `deanchor help`, `deanchor commands`, `/deanchor-help` |

---

## Intensity Levels

Change the intensity with `/deanchor [lite|full|ultra]` (Default: `full`):

*   **Lite:** Decouples data and identifies banned paradigms. Drafts **two** alternative concepts and pauses for user feedback before writing code.
*   **Full (Default):** The Deanchor Protocol strictly enforced. Decouples, bans, conceptualizes a single premium path, and writes the clean-slate code immediately.
*   **Ultra:** Radical redesign. Re-evaluates the core problem definition. Banishes all current tech stacks and frameworks. Proposes a minimal, alternative paradigm (e.g., replacing a React dashboard with a custom Canvas or a keyboard-driven CLI overlay).

---

## Installation

### Node.js CLI
Run the following commands from the project root:

1. **Install Workflows & Skills:**
   ```bash
   node bin/deanchor.js install
   ```

2. **Enable Git Pre-Commit Hook (Auto-Syncing):**
   ```bash
   node bin/deanchor.js init-hook
   ```

3. **Check Status:**
   ```bash
   node bin/deanchor.js status
   ```

4. **Update Graphify Knowledge Graph:**
   ```bash
   node bin/deanchor.js graphify
   ```

5. **Start Graphify MCP Server:**
   ```bash
   node bin/deanchor.js mcp
   ```

6. **Generate Repository Map:**
   ```bash
   node bin/deanchor.js repomap
   ```

*Note: The git pre-commit hook will automatically trigger workflow compilation, a Graphify knowledge graph rebuild (`graphify update`), and an Aider repository map rebuild (`aider --show-repo-map > repo-map.md`) depending on what commands are available on the host system.*

This compiles templates (injecting custom banned paradigms and settings) and installs custom rules into your agent's global paths:
- **Antigravity:** `%USERPROFILE%\.gemini\antigravity\global_workflows\` (resolves to active environment path)
- **Claude Code:** Project-specific `.clauderules` or configuration file instructions.
- **Cursor:** `.cursorrules` in your project root.

---

## Configuration

Configure the default mode in `~/.config/deanchor/config.json` (Windows: `%APPDATA%\deanchor\config.json`):

```json
{
  "defaultMode": "full",
  "ignoredPaths": [
    "node_modules",
    "dist",
    ".git"
  ],
  "customBannedParadigms": [
    "traditional-sidebar-dashboard",
    "use-effect-data-fetching"
  ]
}
```

---

## License

MIT - Break the anchor, explore the space.
