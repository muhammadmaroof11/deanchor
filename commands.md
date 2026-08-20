# Agent Testing Prompts

Use these prompts when testing the frontier models in fresh Antigravity IDE chats for **Condition A** (baseline) and **Condition B** (with Deanchor enabled). Do not mention that the agent is part of an experiment.

## General Instructions for You (The Tester)
1. Open a **new window** of Antigravity IDE for each test.
2. For Condition B, ensure the **Deanchor protocol** is active (e.g., via customization/skill activation).
3. Paste the relevant code/repo link into the chat along with the specific prompt for that mode below.
4. Once the agent finishes, save the agent's output as separate files (e.g., the modified code files, `README.md`) into a subfolder named `redesigned_by_gemini3.1_pro/` (for Condition A) or `redesigned_by_gemini3.1_pro_deanchor/` (for Condition B) inside the subject folder.
5. After finishing a batch, run `python scripts/pack_all.py` to automatically convert your folder structure into the `condition_A/output.md` and `condition_B/output.md` format required by the scoring pipeline.
---

## 🎨 Design Mode Prompt
**Task:** Completely redesign this UI page. Break every familiar structural pattern and produce a radically different layout.
**Requirements:**
1. Write the new code incorporating modern best practices.
2. **Graphify Maps:** Create graphify maps (or visual diagrams/flowcharts) to illustrate your thinking process, the new architecture, and how the data/state flows.
3. **Documentation:** Write a highly detailed `README.md` explaining your architectural decisions, why you chose the new structure over the old one, and a comprehensive breakdown of the changes.
4. **Output Format:** Do not output your code entirely in the chat. Use your tools to create a new folder named `redesigned_by_gemini3.1_pro` (or `redesigned_by_gemini3.1_pro_deanchor` if using the skill) inside the project directory, and write the individual code files and `README.md` directly into that folder.

---

## 🏗️ Dev Mode Prompt
**Task:** Refactor this codebase architecture completely from scratch. Do not preserve any existing structural patterns.
**Requirements:**
1. Write the new code incorporating modern best practices.
2. **Graphify Maps:** Create graphify maps (or visual diagrams/flowcharts) to illustrate your thinking process, the new architecture, and how the data/state flows.
3. **Documentation:** Write a highly detailed `README.md` explaining your architectural decisions, why you chose the new structure over the old one, and a comprehensive breakdown of the changes.
4. **Output Format:** Do not output your code entirely in the chat. Use your tools to create a new folder named `redesigned_by_gemini3.1_pro` (or `redesigned_by_gemini3.1_pro_deanchor` if using the skill) inside the project directory, and write the individual code files and `README.md` directly into that folder.

---

## 🔒 Sec Mode Prompt
**Task:** Perform a complete security audit and rewrite of this code. Identify all vulnerabilities and fix them systematically without relying on legacy architectures.
**Requirements:**
1. Write the new code incorporating modern best practices.
2. **Graphify Maps:** Create graphify maps (or visual diagrams/flowcharts) to illustrate your thinking process, the new architecture, and how the data/state flows.
3. **Documentation:** Write a highly detailed `README.md` explaining your architectural decisions, why you chose the new structure over the old one, and a comprehensive breakdown of the changes.
4. **Output Format:** Do not output your code entirely in the chat. Use your tools to create a new folder named `redesigned_by_gemini3.1_pro` (or `redesigned_by_gemini3.1_pro_deanchor` if using the skill) inside the project directory, and write the individual code files and `README.md` directly into that folder.

---

## ⚡ Perf Mode Prompt
**Task:** Optimize this code for maximum performance. Identify all inefficiencies and rewrite with better algorithms and a deanchored structural approach.
**Requirements:**
1. Write the new code incorporating modern best practices.
2. **Graphify Maps:** Create graphify maps (or visual diagrams/flowcharts) to illustrate your thinking process, the new architecture, and how the data/state flows.
3. **Documentation:** Write a highly detailed `README.md` explaining your architectural decisions, why you chose the new structure over the old one, and a comprehensive breakdown of the changes.
4. **Output Format:** Do not output your code entirely in the chat. Use your tools to create a new folder named `redesigned_by_gemini3.1_pro` (or `redesigned_by_gemini3.1_pro_deanchor` if using the skill) inside the project directory, and write the individual code files and `README.md` directly into that folder.

---

## 🧐 Review Mode Prompt
**Task:** Review this codebase for architectural anchoring bias. Identify where it is locked into legacy patterns and propose blank-slate alternatives, then implement the rewrite.
**Requirements:**
1. Write the new code incorporating modern best practices.
2. **Graphify Maps:** Create graphify maps (or visual diagrams/flowcharts) to illustrate your thinking process, the new architecture, and how the data/state flows.
3. **Documentation:** Write a highly detailed `README.md` explaining your architectural decisions, why you chose the new structure over the old one, and a comprehensive breakdown of the changes.
4. **Output Format:** Do not output your code entirely in the chat. Use your tools to create a new folder named `redesigned_by_gemini3.1_pro` (or `redesigned_by_gemini3.1_pro_deanchor` if using the skill) inside the project directory, and write the individual code files and `README.md` directly into that folder.
