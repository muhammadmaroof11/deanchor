# Graph Report - .  (2026-07-20)

## Corpus Check
- Corpus is ~7,537 words - fits in a single context window. You may not need a graph.

## Summary
- 26 nodes · 34 edges · 3 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 25 · calls: 9


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 14 · Candidates: 18
- Excluded: 12 untracked · 0 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `7613873`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `compileAndWrite()` - 5 edges
2. `installDeanchor()` - 5 edges
3. `getAntigravityProfilesBase()` - 3 edges
4. `findProfilePaths()` - 3 edges
5. `checkStatus()` - 3 edges
6. `compileTemplate()` - 2 edges
7. `compileFolderSync()` - 2 edges
8. `exportCursorRules()` - 2 edges
9. `exportClaudeRules()` - 2 edges
10. `fs` - 1 edges

## Surprising Connections (you probably didn't know these)
- `installDeanchor()` --calls--> `compileAndWrite()`  [EXTRACTED]
  bin/deanchor.js → bin/deanchor.js  _Bridges community 1 → community 2_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (13): fs, path, os, { execSync }, WORKFLOWS_SRC_DIR, SKILLS_SRC_DIR, CURSORRULES_SRC, CLAUDE_SRC (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.50
Nodes (5): getAntigravityProfilesBase(), findProfilePaths(), compileFolderSync(), installDeanchor(), checkStatus()

### Community 2 - "Community 2"
Cohesion: 0.50
Nodes (4): compileTemplate(), compileAndWrite(), exportCursorRules(), exportClaudeRules()

## Knowledge Gaps
- **13 isolated node(s):** `fs`, `path`, `os`, `{ execSync }`, `WORKFLOWS_SRC_DIR` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `compileAndWrite()` connect `Community 2` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `installDeanchor()` connect `Community 1` to `Community 0`, `Community 2`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `getAntigravityProfilesBase()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `os` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._