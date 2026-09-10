### Architectural Overview

To implement the provided semantic YAML schema, we will design a production-grade, decoupled Go package structure. The architecture adheres to **Clean Architecture** and **Domain-Driven Design (DDD)** principles, guaranteeing strict separation of concerns, immutability of graph structures, and robust state-machine management.

#### File Organization

```
.
├── go.mod
├── domain
│   ├── entities.go
│   ├── errors.go
│   └── invariants.go
├── engine
│   ├── router.go
│   ├── router_test.go
│   └── algorithms.go
├── state
│   ├── machine.go
│   └── machine_test.go
└── README.md
```

---

### Implementation

#### 1. Domain Entities & Errors (`domain/entities.go`, `domain/errors.go`)

```go
// Package domain establishes the foundational types, immutable graph topology,
// and business invariants required by the semantic schema.
package domain

import "errors"

// Node represents a vertex in the graph with arbitrary metadata.
type Node struct {
	ID       string                 `json:"id"`
	Metadata map[string]interface{} `json:"metadata"`
}

// Edge represents a directed, weighted, capacitated, and costed link between nodes.
type Edge struct {
	ID       string  `json:"id"`
	SourceID string  `json:"source_id"`
	TargetID string  `json:"target_id"`
	Weight   float64 `json:"weight"`
	Capacity float64 `json:"capacity"`
	Cost     float64 `json:"cost"`
}

// Graph represents an immutable topological network.
type Graph struct {
	Nodes         map[string]Node   `json:"nodes"`
	AdjacencyList map[string][]Edge `json:"adjacency_list"`
}

// Path represents an ordered route through the network.
type Path struct {
	NodeSequence []string `json:"node_sequence"`
	TotalWeight  float64  `json: "total_weight"`
	TotalCost    float64  `json:"total_cost"`
	IsValid      bool     `json:"is_valid"`
}

// DeepCopy ensures topological immutability by cloning the graph structure.
func (g *Graph) DeepCopy() Graph {
	nodesCopy := make(map[string]Node, len(g.Nodes))
	for k, v := range g.Nodes {
		metaCopy := make(map[string]interface{}, len(v.Metadata))
		for mk, mv := range v.Metadata {
			metaCopy[mk] = mv
		}
		nodesCopy[k] = Node{ID: v.ID, Metadata: metaCopy}
	}

	adjCopy := make(map[string][]Edge, len(g.AdjacencyList))
	for k, edges := range g.AdjacencyList {
		edgesCopy := make([]Edge, len(edges))
		copy(edgesCopy, edges)
		adjCopy[k] = edgesCopy
	}

	return Graph{
		Nodes:         nodesCopy,
		AdjacencyList: adjCopy,
	}
}
```

```go
package domain

import "errors"

var (
	ErrNodeNotFound           = errors.New("node not found in graph topology")
	ErrNegativeCycleDetected  = errors.New("negative weight cycle detected during routing computation")
	ErrInvalidMetric          = errors.New("unsupported optimization metric provided")
	ErrInvalidStateTransition = errors.New("illegal state machine transition requested")
)
```

---

#### 2. Shortest Route Engine & Algorithms (`engine/algorithms.go`, `engine/router.go`)

Since edge weights can represent generalized metrics (which may include negative values if handling specific differentials), we implement **Bellman-Ford** with negative cycle detection to satisfy the safety invariants. If metrics are strictly non-negative, Dijkstra's algorithm or Yen's can be swapped seamlessly, but Bellman-Ford provides the ultimate safety guarantee against arbitrary metric configurations.

```go
package engine

import (
	"math"
	"sort"

	"github.com/your-org/repo/domain"
)

// computeShortestPathBellmanFord computes the globally optimal path using Bellman-Ford,
// supporting negative weights and explicitly detecting negative cycles.
func computeShortestPathBellmanFord(graph domain.Graph, sourceID, targetID string, metricSelector func(domain.Edge) float64) (domain.Path, error) {
	if _, exists := graph.Nodes[sourceID]; !exists {
		return invalidPath(), domain.ErrNodeNotFound
	}
	if _, exists := graph.Nodes[targetID]; !exists {
		return invalidPath(), domain.ErrNodeNotFound
	}

	// Extract all nodes and assign index mappings
	nodes := make([]string, 0, len(graph.Nodes))
	for id := range graph.Nodes {
		nodes = append(nodes, id)
	}
	sort.Strings(nodes)

	distances := make(map[string]float64)
	predecessors := make(map[string]string)
	edgeUsedTo := make(map[string]domain.Edge)

	for _, nodeID := range nodes {
		distances[nodeID] = math.Inf(1)
	}
	distances[sourceID] = 0

	// Relax edges |V| - 1 times
	for i := 0; i < len(nodes)-1; i++ {
		updated := false
		for _, u := range nodes {
			if math.IsInf(distances[u], 1) {
				continue
			}
			for _, edge := range graph.AdjacencyList[u] {
				v := edge.TargetID
				weight := metricSelector(edge)
				if distances[u]+weight < distances[v] {
					distances[v] = distances[u] + weight
					predecessors[v] = u
					edgeUsedTo[v] = edge
					updated = true
				}
			}
		}
		if !updated {
			break
		}
	}

	// Check for negative weight cycles
	for _, u := range nodes {
		if math.IsInf(distances[u], 1) {
			continue
		}
		for _, edge := range graph.AdjacencyList[u] {
			v := edge.TargetID
			weight := metricSelector(edge)
			if distances[u]+weight < distances[v] {
				return invalidPath(), domain.ErrNegativeCycleDetected
			}
		}
	}

	// If target is unreachable
	if math.IsInf(distances[targetID], 1) {
		return invalidPath(), nil
	}

	// Reconstruct path
	var sequence []string
	curr := targetID
	for curr != sourceID {
		sequence = append([]string{curr}, sequence...)
		curr = predecessors[curr]
	}
	sequence = append([]string{sourceID}, sequence...)

	// Calculate cumulative metrics
	var totalWeight, totalCost float64
	for i := 0; i < len(sequence)-1; i++ {
		u := sequence[i]
		v := sequence[i+1]
		for _, edge := range graph.AdjacencyList[u] {
			if edge.TargetID == v {
				totalWeight += edge.Weight
				totalCost += edge.Cost
				break
			}
		}
	}

	return domain.Path{
		NodeSequence: sequence,
		TotalWeight:  totalWeight,
		TotalCost:    totalCost,
		IsValid:      true,
	}, nil
}

func invalidPath() domain.Path {
	return domain.Path{
		NodeSequence: []string{},
		TotalWeight:  0,
		TotalCost:    0,
		IsValid:      false,
	}
}
```

```go
package engine

import (
	"fmt"

	"github.com/your-org/repo/domain"
)

// Router encapsulates graph routing operations upholding topological immutability.
type Router struct{}

func NewRouter() *Router {
	return &Router{}
}

// ComputeShortestRoute executes the functional operation matching the domain schema.
func (r *Router) ComputeShortestRoute(graph domain.Graph, sourceID, targetID, optimizationMetric string) (domain.Path, error) {
	// Invariant: Graph topology must remain immutable during computation.
	// We achieve this via deep-copying the graph state prior to execution.
	immutableGraph := graph.DeepCopy()

	var metricSelector func(domain.Edge) float64
	switch optimizationMetric {
	case "weight":
		metricSelector = func(e domain.Edge) float64 { return e.Weight }
	case "cost":
		metricSelector = func(e domain.Edge) float64 { return e.Cost }
	default:
		return invalidPath(), fmt.