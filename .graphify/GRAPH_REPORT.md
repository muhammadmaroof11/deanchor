# Graph Report - .  (2026-07-20)

## Corpus Check
- Corpus is ~10,209 words - fits in a single context window. You may not need a graph.

## Summary
- 61 nodes · 69 edges · 6 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 57 · calls: 10 · imports_from: 2


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 19 · Candidates: 35
- Excluded: 1 untracked · 0 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `7b39482`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `compileAndWrite()` - 5 edges
2. `installDeanchor()` - 5 edges
3. `getAntigravityProfilesBase()` - 3 edges
4. `findProfilePaths()` - 3 edges
5. `checkStatus()` - 3 edges
6. `compileTemplate()` - 2 edges
7. `compileAndWrite()` - 2 edges
8. `compileTemplate()` - 2 edges
9. `compileFolderSync()` - 2 edges
10. `exportCursorRules()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `installDeanchor()` --calls--> `compileAndWrite()`  [EXTRACTED]
  bin/deanchor.js → bin/deanchor.js  _Bridges community 3 → community 5_

## Communities

### Community 4 - "Community 4"
Cohesion: 0.50
Nodes (2): commands, args

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (10): fs, path, os, { execSync }, compiler, WORKFLOWS_SRC_DIR, SKILLS_SRC_DIR, CURSORRULES_SRC (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.20
Nodes (8): fs, path, os, configPath, config, raw, compileTemplate(), compileAndWrite()

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (14): commands, args, fs, path, os, { execSync }, WORKFLOWS_SRC_DIR, SKILLS_SRC_DIR (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.50
Nodes (5): getAntigravityProfilesBase(), findProfilePaths(), compileFolderSync(), installDeanchor(), checkStatus()

### Community 5 - "Community 5"
Cohesion: 0.50
Nodes (4): compileTemplate(), compileAndWrite(), exportCursorRules(), exportClaudeRules()

## Knowledge Gaps
- **32 isolated node(s):** `commands`, `args`, `fs`, `path`, `os` (+27 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 4`** (2 nodes): `commands`, `args`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `compileAndWrite()` connect `Community 5` to `Community 1`, `Community 3`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **Why does `installDeanchor()` connect `Community 3` to `Community 1`, `Community 5`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **Why does `getAntigravityProfilesBase()` connect `Community 3` to `Community 1`?**
  _High betweenness centrality (0.000) - this node is a cross-community bridge._
- **What connects `commands`, `args`, `fs` to the rest of the system?**
  _32 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._