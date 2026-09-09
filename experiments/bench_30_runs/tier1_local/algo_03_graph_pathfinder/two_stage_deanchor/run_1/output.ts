# Production-Grade Greenfield Implementation for Graph-Based Routing System

## Architecture Overview

This implementation follows a clean, modular architecture with clear separation of concerns. The system is designed around domain entities and functional operations while maintaining state contracts through explicit lifecycle management.

### Key Design Principles:
1. **Domain-Centric**: All logic directly maps to the provided YAML schema
2. **Immutable Data Structures**: Ensures thread safety and predictable behavior
3. **State Machine Pattern**: Explicitly manages system states according to contract requirements
4. **Functional Programming Idioms**: Pure functions where possible, with clear input/output boundaries
5. **Type Safety**: Full type annotations for compile-time guarantees

## File Structure

```
src/
├── main/
│   ├── java/
│   │   └── com/
│   │       └── graphsystem/
│   │           ├── domain/
│   │           │   ├── entities/
│   │           │   │   ├── Node.java
│   │           │   │   ├── Edge.java
│   │           │   │   ├── Graph.java
│   │           │   │   ├── Path.java
│   │           │   │   └── RouteQuery.java
│   │           │   ├── operations/
│   │           │   │   ├── ShortestPathFinder.java
│   │           │   │   ├── NodeAdder.java
│   │           │   │   └── EdgeAdder.java
│   │           │   └── state/
│   │           │       ├── GraphState.java
│   │           │       ├── StateMachine.java
│   │           │       └── GraphLifecycleEvent.java
│   │           ├── infrastructure/
│   │           │   ├── GraphRepository.java
│   │           │   └── InMemoryGraphStore.java
│   │           └── service/
│   │               └── GraphService.java
│   └── resources/
│       └── application.properties
└── test/
    └── java/
        └── com/
            └── graphsystem/
                ├── domain/
                │   ├── entities/
                │   │   ├── NodeTest.java
                │   │   ├── EdgeTest.java
                │   │   ├── GraphTest.java
                │   │   ├── PathTest.java
                │   │   └── RouteQueryTest.java
                │   ├── operations/
                │   │   ├── ShortestPathFinderTest.java
                │   │   ├── NodeAdderTest.java
                │   │   └── EdgeAdderTest.java
                │   └── state/
                │       ├── GraphStateTest.java
                │       └── StateMachineTest.java
                └── service/
                    └── GraphServiceTest.java
```

## Core Implementation

### 1. Domain Entities

#### Node.java
```java
package com.graphsystem.domain.entities;

import java.util.Objects;
import java.util.Tuple;

public class Node {
    private final String id;
    private final Tuple<Float, Float> coordinates;
    
    public Node(String id, Tuple<Float, Float> coordinates) {
        this.id = Objects.requireNonNull(id);
        this.coordinates = Objects.requireNonNull(coordinates);
    }
    
    // Getters
    public String getId() { return id; }
    public Tuple<Float, Float> getCoordinates() { return coordinates; }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Node)) return false;
        Node node = (Node) o;
        return Objects.equals(id, node.id);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
```

#### Edge.java
```java
package com.graphsystem.domain.entities;

import java.util.Objects;

public class Edge {
    private final Node source;
    private final Node target;
    private final Float weight;
    private final Boolean isBidirectional;
    
    public Edge(Node source, Node target, Float weight, Boolean isBidirectional) {
        this.source = Objects.requireNonNull(source);
        this.target = Objects.requireNonNull(target);
        this.weight = Objects.requireNonNull(weight);
        this.isBidirectional = Objects.requireNonNull(isBidirectional);
    }
    
    // Getters
    public Node getSource() { return source; }
    public Node getTarget() { return target; }
    public Float getWeight() { return weight; }
    public Boolean isBidirectional() { return isBidirectional; }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Edge)) return false;
        Edge edge = (Edge) o;
        return Objects.equals(source, edge.source) &&
               Objects.equals(target, edge.target);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(source, target);
    }
}
```

#### Graph.java
```java
package com.graphsystem.domain.entities;

import java.util.Objects;
import java.util.Set;
import java.util.HashSet;

public class Graph {
    private final Set<Node> nodes;
    private final Set<Edge> edges;
    
    public Graph(Set<Node> nodes, Set<Edge> edges) {
        this.nodes = Objects.requireNonNull(nodes);
        this.edges = Objects.requireNonNull(edges);
    }
    
    // Getters
    public Set<Node> getNodes() { return new HashSet<>(nodes); }
    public Set<Edge> getEdges() { return new HashSet<>(edges); }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Graph)) return false;
        Graph graph = (Graph) o;
        return Objects.equals(nodes, graph.nodes) &&
               Objects.equals(edges, graph.edges);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(nodes, edges);
    }
}
```

#### Path.java
```java
package com.graphsystem.domain.entities;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

public class Path {
    private final List<Edge> segments;
    private final Float totalWeight;
    
    public Path(List<Edge> segments, Float totalWeight) {
        this.segments = Objects.requireNonNull(segments);
        this.totalWeight = Objects.requireNonNull(totalWeight);
    }
    
    // Getters
    public List<Edge> getSegments() { return segments; }
    public Float getTotalWeight() { return totalWeight; }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Path)) return false;
        Path path = (Path) o;
        return Objects.equals(segments, path.segments) &&
               Objects.equals(totalWeight, path.totalWeight);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(segments, totalWeight);
    }
}
```

#### RouteQuery.java
```java
package com.graphsystem.domain.entities;

import java.util.Map;
import java.util.Objects;

public class RouteQuery {
    private final Node sourceNode;
    private final Node targetNode;
    private final Map<String, Object> constraints;
    
    public RouteQuery(Node sourceNode, Node targetNode, Map<String, Object> constraints) {
        this.sourceNode = Objects.requireNonNull(sourceNode);
        this.targetNode = Objects.requireNonNull(targetNode);
        this.constraints = Objects.requireNonNull(constraints);
    }
    
    // Getters
    public Node getSourceNode() { return sourceNode; }
    public Node getTargetNode() { return targetNode; }
    public Map<String, Object> getConstraints() { return constraints; }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RouteQuery)) return false;
        RouteQuery that = (RouteQuery) o;
        return Objects.equals(sourceNode, that.sourceNode) &&
               Objects.equals(targetNode, that.targetNode) &&
               Objects.equals(constraints, that.constraints);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(sourceNode, targetNode, constraints);
    }
}
```

### 2. Functional Operations

#### ShortestPathFinder.java
```java
package com.graphsystem.domain.operations;

import com.graphsystem.domain.entities.*;
import java.util.*;

public class ShortestPathFinder {
    
    public static Path findShortestPath(Graph graph, RouteQuery query) {
        // Validate inputs according to invariants
        validateGraphContainsNodes(graph, query);
        
        // Implementation of Dijkstra's algorithm or similar shortest path algorithm
        Map<Node, Float> distances = new HashMap<>();
        Map<Node, Edge> previousEdges = new HashMap<>();
        PriorityQueue<Node> unvisited = new PriorityQueue<>(Comparator.comparing(distances::get));
        
        // Initialize all nodes with infinite distance except source
        for (Node node : graph.getNodes()) {
            distances.put(node, Float.POSITIVE_INFINITY);
            if (node.equals(query.getSourceNode())) {
                distances.put(node, 0.0f);
            }
            unvisited.add(node);
        }
        
        while (!unvisited.isEmpty()) {
            Node current = unvisited.poll();
            
            // If we've reached the target node or distance is infinity, stop
            if (current.equals(query.getTargetNode()) || 
                distances.get(current) == Float.POSITIVE_INFINITY) {
                break;
            }
            
            // Check neighbors and update shortest paths
            for (Edge edge : graph.getEdges()) {
                if (edge.getSource().equals(current)) {
                    Node neighbor = edge.getTarget();
                    float newDistance = distances.get(current) + edge.getWeight();
                    
                    if (newDistance < distances.get(neighbor)) {
                        distances.put(neighbor, newDistance);
                        previousEdges.put(neighbor, edge