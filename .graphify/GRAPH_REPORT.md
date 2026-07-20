# Graph Report - .  (2026-07-20)

## Corpus Check
- Corpus is ~11,916 words - fits in a single context window. You may not need a graph.

## Summary
- 63 nodes · 77 edges · 7 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 59 · calls: 16 · imports_from: 2


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 20 · Candidates: 36
- Excluded: 3 untracked · 0 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `2db8d35`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `compileAndWrite()` - 5 edges
2. `installDeanchor()` - 5 edges
3. `compileUnifiedFile()` - 4 edges
4. `installDeanchor()` - 4 edges
5. `exportCursorRules()` - 3 edges
6. `exportClaudeRules()` - 3 edges
7. `exportCodexRules()` - 3 edges
8. `getAntigravityProfilesBase()` - 3 edges
9. `findProfilePaths()` - 3 edges
10. `checkStatus()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `installDeanchor()` --calls--> `compileAndWrite()`  [EXTRACTED]
  bin/deanchor.js → bin/deanchor.js  _Bridges community 3 → community 6_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (14): args, CLAUDE_SRC, CODEX_SRC, commands, config, configPath, CURSORRULES_SRC, { execSync } (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (10): CLAUDE_SRC, CODEX_SRC, compiler, CURSORRULES_SRC, { execSync }, fs, os, path (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.20
Nodes (8): compileAndWrite(), compileTemplate(), config, configPath, fs, os, path, raw

### Community 3 - "Community 3"
Cohesion: 0.50
Nodes (5): checkStatus(), compileFolderSync(), findProfilePaths(), getAntigravityProfilesBase(), installDeanchor()

### Community 4 - "Community 4"
Cohesion: 0.60
Nodes (5): compileUnifiedFile(), exportClaudeRules(), exportCodexRules(), exportCursorRules(), installDeanchor()

### Community 5 - "Community 5"
Cohesion: 0.50
Nodes (2): args, commands

### Community 6 - "Community 6"
Cohesion: 0.50
Nodes (4): compileAndWrite(), compileTemplate(), exportClaudeRules(), exportCursorRules()

## Knowledge Gaps
- **32 isolated node(s):** `commands`, `args`, `fs`, `path`, `os` (+27 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 5`** (2 nodes): `args`, `commands`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `compileAndWrite()` connect `Community 6` to `Community 0`, `Community 3`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **Why does `installDeanchor()` connect `Community 3` to `Community 0`, `Community 6`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **Why does `compileUnifiedFile()` connect `Community 4` to `Community 1`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `commands`, `args`, `fs` to the rest of the system?**
  _32 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._