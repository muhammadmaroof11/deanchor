### Architectural Critique: The "Ghost Source" Problem

**1. Source Code Verification Failure**
The provided "Source Code" consisted exclusively of a header comment:
```cpp
// Benchmark Source Code for Graph Pathfinder Shortest Route
// Domain: Algorithmic & Fintech | LOC: 950
```
**Zero executable logic, data structures, or invariants were present.** My previous draft was a *speculative greenfield design* (Hexagonal/CQRS/Event Sourcing in Rust/Go) reverse-engineered solely from the metadata keywords ("Algorithmic", "Fintech", "950 LOC"). It did not refactor *anything*; it invented a system.

**2. Anchored Assumptions vs. Benchmark Reality**
*   **Over-Architected for a Benchmark:** A 950 LOC "Benchmark" typically implies a **single-file or minimal-module algorithmic kernel** (e.g., a DIMACS challenge entry, a custom Contraction Hierarchies implementation, or a highly optimized Dijkstra/A* variant), not a distributed microservice ecosystem with Kafka, gRPC, and Event Sourcing.
*   **Wrong Paradigm:** Fintech *benchmarks* prioritize **throughput/latency of the core algorithm** (ns/op, cache misses, branch prediction). They explicitly *avoid* abstraction layers (virtual calls, heap allocation, locks) that Hexagonal/CQRS introduces.
*   **Missing "Shortest Route" Invariants:** The draft invented `NodeMeta`, `EdgeType`, `Capacity`, `GeoCoord`. A standard benchmark graph usually has: `NodeID`, `TargetNodeID`, `Weight` (uint32/float). That is the *only* invariant.

**3. Preservation Score: 0%**
No business logic was preserved because none existed. The draft introduced **phantom domain complexity** (Tenants, Compliance, Settlement) absent from the prompt.

---

### Revised Strategy: The "950 LOC Algorithmic Kernel" Greenfield Implementation

**Target:** A **single-header, zero-dependency, C++20** implementation representing a modernized, cache-optimized **Customizable Contraction Hierarchies (CCH)** kernel. This matches the "Algorithmic & Fintech | 950 LOC" profile: a high-performance, mutable-weight routing engine suitable for Smart Order Routing (SOR) or Payment Pathfinding, stripped of all infrastructure noise.

**Architectural Pillars:**
1.  **Data-Oriented Design (DoD):** Structure of Arrays (SoA), `std::vector` contiguous memory, no `std::map`/`std::unordered_map` in hot path.
2.  **Customizable Metrics (CCH):** Separation of **Topology (Static)** vs **Weights (Dynamic)**. Re-customization in **~microseconds** (critical for Fintech fee/liquidity changes).
3.  **Parallelizable:** Query/Preprocessing thread-safe by design (immutable topology, thread-local scratchpad).
4.  **Benchmark Harness Included:** `main()` drives DIMACS-style throughput/latency measurement.

---

### `graph_pathfinder.hpp` (Complete, ~850 LOC)

```cpp
#pragma once
// Graph Pathfinder: Customizable Contraction Hierarchies (CCH) Kernel
// Domain: Algorithmic & Fintech | Target: ~950 LOC | Standard: C++20
// Philosophy: Data-Oriented, Zero-Abstraction Overhead, Cache-Conscious.

#include <algorithm>
#include <array>
#include <atomic>
#include <bit>
#include <cassert>
#include <chrono>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <execution>
#include <fstream>
#include <functional>
#include <iomanip>
#include <iostream>
#include <limits>
#include <memory>
#include <numeric>
#include <random>
#include <span>
#include <vector>

// ================================================================================================
// 1. FUNDAMENTAL TYPES & CONSTANTS (DoD Primitives)
// ================================================================================================

using NodeId      = uint32_t;
using EdgeId      = uint32_t;
using Weight      = uint32_t;          // Integer weights (fixed-point) for determinism/SIMD
using Timestamp   = uint64_t;          // For weight versioning
constexpr Weight  INF_WEIGHT = std::numeric_limits<Weight>::max() / 4;
constexpr NodeId  INVALID_NODE = std::numeric_limits<NodeId>::max();
constexpr EdgeId  INVALID_EDGE = std::numeric_limits<EdgeId>::max();

// Cache line alignment for thread-local scratchpads
constexpr size_t CACHE_LINE = 64;
template <typename T> using AlignedVec = std::vector<T, std::allocator<T>>; // Placeholder for aligned_allocator

// ================================================================================================
// 2. TOPOLOGY (IMMUTABLE, STATIC, SHARED READ-ONLY)
// ================================================================================================

struct GraphTopology {
    // CSR (Compressed Sparse Row) - Forward & Backward (for CH Up/Down)
    // Indices: [0..num_nodes] -> offsets into edges/targets
    AlignedVec<uint32_t>    head_fwd;     // size: num_nodes + 1
    AlignedVec<uint32_t>    head_bwd;     // size: num_nodes + 1
    
    // Edge Data (Parallel Arrays - SoA)
    AlignedVec<NodeId>      target_fwd;   // size: num_edges
    AlignedVec<NodeId>      target_bwd;   // size: num_edges (reverse edges)
    AlignedVec<EdgeId>      edge_id_fwd;  // size: num_edges (maps to weight array index)
    AlignedVec<EdgeId>      edge_id_bwd;  // size: num_edges
    
    // Contraction Hierarchy Order & Shortcuts
    AlignedVec<NodeId>      rank;         // size: num_nodes. rank[node] = contraction order (0..N-1)
    AlignedVec<uint32_t>    shortcut_fwd_head; // CSR for shortcut edges only
    AlignedVec<NodeId>      shortcut_fwd_target;
    AlignedVec<EdgeId>      shortcut_fwd_eid;  // Maps to *same* weight array (logical multi-edge