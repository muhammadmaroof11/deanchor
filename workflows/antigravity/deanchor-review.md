---
description: Code/design review focused on identifying anchoring bias. Finds where code or layouts are constrained by legacy structures instead of adopting a clean-slate approach, listing anchored spots and suggesting blank-slate redesign paths. Auto-activates on "review for anchoring", "find anchored code", "anchoring audit", "deanchor-review".
---

# Deanchor Review 🔍➡️🌌

Review files, diffs, or PRs for **contextual anchoring**. This review identifies lines, modules, or layout components where the implementation is constrained by the legacy code or layout it was built upon, rather than taking a clean-slate approach to solve the core data requirements.

*Use when the user says "review for anchoring", "find anchored code", "anchoring audit", "deanchor-review", or invokes `/deanchor-review`.*

---

## Scan & Identify Anchors

Search the target code/design for the following "Anchor Tells":
1. **Structural Patching:** Adding conditionals/props to a component to fit a new feature, rather than creating a separate single-purpose component or restructuring the state.
2. **Visual Templating:** Reusing generic UI blocks (like standard grid lists) because they are already in the file, even if the data requires a custom visualization.
3. **Data/Presentation Coupling:** UI components managing complex fetching logic or state transformation that should be in a separate hook/store.
4. **Boilerplate Carryover:** Code that carries forward imports, types, or helper structures that are no longer needed but are preserved "just in case" or out of habit.

---

## Graphify-Driven Review 🕸️

If `.graphify/` is present in the workspace:
1. **Targeted Review Context**: Prior to auditing changes or files, run `graphify review-analysis --files <target_files>` to check the community membership, blast radius, and potential regression risks of the modified code.
2. **Review Delta**: Use `graphify review-delta --files <target_files>` or `graphify review-context --files <target_files>` to focus the review on dependency impacts, reducing token waste and false positives.

---

## Format

Output the findings in a structured table format with one line per finding:

| Location | Anchored Pattern | Core Data/Fact | Deanchored Redesign Path |
| :--- | :--- | :--- | :--- |
| `path/to/file.ext:L10` | [What is anchoring the code] | [The raw requirement] | [How to write it from a blank slate] |

End the review with:
- **Anchoring Score:** `Anchored Index: [High/Medium/Low] - [N] anchors found.`
- **Call to Action:** A brief statement indicating whether a complete refactor is recommended or if the current structure is acceptable.

---

## Example Review Output

### 🔍 Deanchor Review: `components/Dashboard.tsx`

| Location | Anchored Pattern | Core Data/Fact | Deanchored Redesign Path |
| :--- | :--- | :--- | :--- |
| `Dashboard.tsx:L45-70` | Standard grid card displaying metrics with hardcoded titles. | Show system health status and alerts. | Build an interactive event timeline that flashes alert states on state mutation, removing the static grid completely. |
| `Dashboard.tsx:L120` | Inline fetch and state logic mixed with render hooks. | Fetch current user preferences. | Move user preference retrieval to a custom React Context provider and load on application mount. |

**Anchoring Score:** `Anchored Index: High - 2 major anchors found.`
**Recommendation:** Refactor recommended. Run `/deanchor-dev` on `components/Dashboard.tsx` to decoupling state and redesign the layout.
