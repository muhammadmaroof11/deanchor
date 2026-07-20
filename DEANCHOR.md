# Deanchor Brain Ledger ⚓➡️🌌

This file is the persistent cognitive ledger for the `deanchor` skill. It serves as the project's "memory block" to prevent context drift and track the progression of blank-slate redesigns.

---

## 1. Decoupled Data Contracts

### Rule Distribution Engine
- **Inputs:** Rule templates, platform path overrides, config constraints.
- **Outputs:** Evaluated/compiled active rules in target directories (Antigravity, Claude Code, Cursor, Codex).
- **State Properties:** Configuration file parameters, platform discovery flags.
- **Business Rules:** Cross-platform path validation, safety/business logic preservation blocks.

---

## 2. Banned Paradigms Ledger

- 🚫 **Duplicate Path Scripts:** Separate platform-specific installer scripts (e.g., duplicating copy logic between `.ps1` and `.js`).
- 🚫 **Static Text Replication:** Copying static text blocks across files manually instead of compile-time templating.
- 🚫 **Manual Execution Requirement:** Requiring manual run commands (`install.ps1`) to distribute changes.

---

## 3. Recommended Ascended Architectures

### ✅ Deanchor Distribution Compiler & Git Hook
- **Status:** Implemented
- **Original BS:** Manual file copying via multiple installer scripts.
- **Ascended Vision:** A unified Node-based compiler that dynamically injects configuration values into rule templates and auto-syncs using a pre-commit git hook.
- **Upgrade Path:**
  1. Consolidate installation logic into `bin/deanchor.js` with cross-platform auto-discovery. (Done)
  2. Implement variable interpolation (`{{placeholder}}`) in template rules. (Done)
  3. Create an automated git hook installer (`deanchor init-hook`). (Done)
  4. Deprecate `install.ps1`. (Done)

### ✅ Graphify Codebase Knowledge Graph Integration
- **Status:** Implemented
- **Original BS:** Exploratory grep/find commands leading to high token usage and contextual anchoring.
- **Ascended Vision:** Integrate Graphify's AST and community mapping into the Deanchor workflow. Rebuild the graph automatically on git pre-commit, and restrict agent operations to the active code cluster.
- **Upgrade Path:**
  1. Add `graphify` subcommand inside `bin/deanchor.js`. (Done)
  2. Inject automatic `graphify update` validation check in git pre-commit hook. (Done)
  3. Update rule templates to instruct agents to use `.graphify/GRAPH_REPORT.md` and review-delta subcommands to optimize context window and bypass irrelevant structures. (Done)

### ✅ Aider Repository Map & Model Context Protocol (MCP) Integration
- **Status:** Implemented
- **Original BS:** Redundant codebase indexing or custom indexers forcing developers to configure multiple environments.
- **Ascended Vision:** Expose Graphify's built-in MCP server and unify Aider's repository map generation into a single unified CLI interface. The system dynamically runs Aider's map generator when available, falling back to Graphify's community map when it isn't.
- **Upgrade Path:**
  1. Create `mcp` subcommand in `deanchor.js` to serve Graphify graphs over stdio. (Done)
  2. Create `repomap` subcommand in `deanchor.js` to automatically output Aider-style signatures or Graphify reports. (Done)
  3. Update Git hook to auto-update both Aider and Graphify structures if they are present on commit. (Done)

---

## 4. Redesign Log

- **2026-07-13:** Project initialized, Git repository configured with 5 commits. Frowning expert persona integrated across all platform rules.
- **2026-07-20:** Graphify, Aider repository maps, and Model Context Protocol (MCP) integrations implemented. Subcommands for `graphify`, `mcp`, and `repomap` added, pre-commit hooks configured to automatically rebuild indices, and updated templates distributed to the active user environment.
