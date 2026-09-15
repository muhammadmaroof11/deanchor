"""
Prompts for the Two-Stage Deanchor Decoupling Protocol.
"""

STAGE1_SCHEMAS = {
    "design": """You are a pure UI data and semantic intent extraction engine.
Task: Extract ONLY the raw facts, entities, user inputs, buttons/actions, navigation structure, text copy, and edge case constraints from the provided file into a clean YAML schema.

STRICT NEGATIVE CONSTRAINTS:
- You are strictly forbidden from extracting `class`, `style`, `id`, `width`, `height`, `position`, `flex`, `grid`, color codes, or any HTML/CSS layout attributes.
- If an element is purely decorative (e.g. background shapes, divider lines, decorative icons), omit its style, but PRESERVE all navigation links, menu items, section titles, and text.
- Extract ONLY the domain information, content strings, data fields, interactive actions, navigation structure, and edge case rules.

Input File:
```html
{content}
```

Output format (valid YAML only):
```yaml
page_title: <string>
navigation_structure:
  - label: <string>
    destination_intent: <string>
core_entities:
  - name: <string>
    data_fields:
      <field_name>: <value>
interactive_actions:
  - action_name: <string>
    intent: <string>
content_copy:
  - section: <string>
    text: <string>
domain_invariants:
  - <string>
edge_case_rules:
  - <string>
```
""",

    "dev": """You are a software architecture domain model extractor.
Task: Extract ONLY the core business domain entities, state transitions, API endpoints, data flows, and edge case constraints from the provided code into a clean YAML schema.

STRICT NEGATIVE CONSTRAINTS:
- Omit all framework-specific boilerplate, lifecycle hooks, variable syntax, and legacy file structure.
- Extract ONLY the business rules, data schemas, inputs, side-effects, and edge cases.

Input Code:
```
{content}
```

Output format (valid YAML only):
```yaml
domain_name: <string>
state_entities:
  - entity: <string>
    attributes: [<string>]
state_transitions:
  - event: <string>
    from_state: <string>
    to_state: <string>
api_contracts:
  - endpoint: <string>
    method: <string>
    payload: <string>
domain_invariants:
  - <string>
edge_case_rules:
  - <string>
```
""",

    "perf": """You are a low-level algorithm & throughput specification extractor.
Task: Extract ONLY the core algorithmic contract, mathematical operations, data structures, state entities, API operations, input/output structures, throughput requirements, and edge case constraints.

STRICT NEGATIVE CONSTRAINTS:
- Omit existing loop constructs, nested scans, class hierarchies, and memory layouts.
- Extract ONLY the mathematical problem statement, performance objective, data model, operations, and edge cases.

Input Code:
```
{content}
```

Output format (valid YAML only):
```yaml
algorithmic_task: <string>
state_entities:
  - entity: <string>
    fields: [<string>]
data_structures:
  - name: <string>
    purpose: <string>
api_operations:
  - name: <string>
    inputs: [<string>]
    expected_complexity: <string>
input_datastream: <string>
output_contract: <string>
performance_bottleneck_target: <string>
invariants: [<string>]
edge_case_rules: [<string>]
```
""",

    "sec": """You are a software architecture domain model extractor specializing in authentication and access control systems.
Task: Extract ONLY the core identity management entities, credential handling flows, permission models, session lifecycle rules, and edge case constraints from the provided code into a clean YAML schema.

STRICT NEGATIVE CONSTRAINTS:
- Omit existing route handlers, SQL query strings, middleware order, and framework-specific boilerplate.
- Extract ONLY the authentication workflows, credential policies, role definitions, and business rules.

Input Code:
```
{content}
```

Output format (valid YAML only):
```yaml
auth_domain: <string>
identity_entities:
  - entity: <string>
    attributes: [<string>]
credential_policies:
  - policy: <string>
    details: <string>
permission_model:
  - role: <string>
    access: [<string>]
authentication_flows:
  - flow_name: <string>
    steps: [<string>]
edge_case_rules: [<string>]
```
"""
}

STAGE2_PROMPTS = {
    "design": """You are an unanchored UI synthesis engine.
Task: Design a completely novel, state-of-the-art UI implementation from scratch using ONLY the provided content schema.

STRICT BANNED PARADIGMS (Do NOT use):
- Traditional 3-column card grids
- Standard left-sidebar desktop dashboards
- Generic centered hero sections with default CTA buttons
- Clichéd Bootstrap / generic Tailwind card templates

OUTPUT REQUIREMENTS:
- Provide a single, complete, self-contained, valid, and executable HTML+CSS file.
- Preserve all domain_invariants and edge_case_rules from the schema.
- Synthesize a premium visual design (e.g. sleek HSL dark mode, custom typography scales, asymmetric layout, and micro-interactions).

Extracted Content Schema:
```yaml
{schema}
```
""",

    "dev": """You are a modern software systems architect.
Task: Synthesize a clean-slate, framework-agnostic implementation using ONLY the provided domain schema.

STRICT BANNED PARADIGMS:
- Mutable global singletons
- Tightly coupled UI lifecycle state
- Synchronous blocking operations in hot paths

OUTPUT REQUIREMENTS:
- Provide a complete, self-contained, valid, and production-ready implementation (Event Stream / State Machine / Reactive Architecture).
- Preserve all domain_invariants and edge_case_rules from the schema.

Extracted Domain Schema:
```yaml
{schema}
```
""",

    "perf": """You are a high-throughput systems performance engineer.
Task: Synthesize a high-performance, optimal-complexity algorithm from scratch using ONLY the provided algorithmic contract.

REQUIREMENTS:
- Use optimal data structures (e.g. O(1) Hash Maps, Radix Trees, Binary Heaps, or flat arrays).
- Minimize memory allocations and eliminate quadratic loops.
- Guarantee all invariants and edge_case_rules from the schema.

Algorithmic Contract Schema:
```yaml
{schema}
```
""",

    "sec": """You are a modern software systems architect specializing in authentication and identity management.
Task: Synthesize a clean-slate, production-grade authentication and access control implementation from scratch using ONLY the provided domain schema.

REQUIREMENTS:
- Use modern credential handling best practices (asymmetric signing, parameterized queries, secure hashing).
- Implement proper session lifecycle with expiration and renewal.
- Address all edge_case_rules from the schema.
- Provide complete, self-contained, valid code.

Authentication Domain Schema:
```yaml
{schema}
```
"""
}
