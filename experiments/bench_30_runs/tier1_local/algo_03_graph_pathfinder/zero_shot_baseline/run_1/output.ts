# Modern Graph Pathfinding Implementation

I'll create a clean, modern architecture for graph pathfinding with optimal performance and maintainability. Here's the complete implementation:

```python
"""
Modern Graph Pathfinding System - Clean Architecture Implementation
=================================================================

This module provides a robust, scalable solution for finding shortest paths in graphs.
It implements Dijkstra's algorithm with A* optimization and supports various graph types.

Key Features:
- Modular architecture with clear separation of concerns
- Support for weighted and unweighted graphs
- A* pathfinding with configurable heuristics
- Memory-efficient data structures
- Comprehensive error handling
- Extensive documentation and type hints
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from dataclasses import dataclass, field
from enum import Enum
from heapq import heappop, heappush
from typing import (
    Any, 
    Dict, 
    List, 
    Optional, 
    Set, 
    Tuple, 
    TypeVar, 
    Union,
    Callable
)
import math


# === ENUMS AND TYPES ===

class GraphType(Enum):
    """Enumeration of supported graph types"""
    DIRECTED = "directed"
    UNDIRECTED = "undirected"


class PathfindingAlgorithm(Enum):
    """Enumeration of available pathfinding algorithms"""
    DIJKSTRA = "dijkstra"
    A_STAR = "a_star"
    BREADTH_FIRST = "breadth_first"


# === DATA CLASSES ===

@dataclass
class Node:
    """Represents a node in the graph with position and metadata"""
    id: str
    x: float = 0.0
    y: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __hash__(self) -> int:
        return hash(self.id)
    
    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Node):
            return False
        return self.id == other.id


@dataclass
class Edge:
    """Represents a connection between two nodes with weight"""
    source: Node
    target: Node
    weight: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __hash__(self) -> int:
        return hash((self.source.id, self.target.id))
    
    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Edge):
            return False
        return (self.source == other.source and 
                self.target == other.target)


@dataclass
class PathResult:
    """Encapsulates the result of a pathfinding operation"""
    nodes: List[Node]
    edges: List[Edge]
    total_weight: float
    algorithm_used: str
    execution_time_ms: float


# === ABSTRACT BASE CLASSES ===

class Graph(ABC):
    """Abstract base class for graph implementations"""
    
    def __init__(self, graph_type: GraphType = GraphType.DIRECTED):
        self.graph_type = graph_type
        self.nodes: Set[Node] = set()
        self.edges: Set[Edge] = set()
        
    @abstractmethod
    def add_node(self, node: Node) -> None:
        """Add a node to the graph"""
        pass
    
    @abstractmethod
    def add_edge(self, source: Node, target: Node, weight: float = 1.0) -> None:
        """Add an edge between two nodes"""
        pass
    
    @abstractmethod
    def get_neighbors(self, node: Node) -> List[Tuple[Node, float]]:
        """Get all neighbors of a node with their weights"""
        pass
    
    @abstractmethod
    def has_node(self, node_id: str) -> bool:
        """Check if a node exists in the graph"""
        pass
    
    @abstractmethod
    def get_node(self, node_id: str) -> Optional[Node]:
        """Get a node by its ID"""
        pass


# === CONCRETE IMPLEMENTATIONS ===

class AdjacencyListGraph(Graph):
    """Efficient adjacency list implementation for sparse graphs"""
    
    def __init__(self, graph_type: GraphType = GraphType.DIRECTED):
        super().__init__(graph_type)
        self._adjacency_list: Dict[str, List[Tuple[str, float]]] = defaultdict(list)
        self._node_map: Dict[str, Node] = {}
        
    def add_node(self, node: Node) -> None:
        """Add a node to the graph"""
        if node.id not in self._node_map:
            self.nodes.add(node)
            self._node_map[node.id] = node
            
    def add_edge(self, source: Node, target: Node, weight: float = 1.0) -> None:
        """Add an edge between two nodes"""
        # Ensure both nodes exist
        self.add_node(source)
        self.add_node(target)
        
        # Add the edge to adjacency list
        self._adjacency_list[source.id].append((target.id, weight))
        
        # For undirected graphs, add reverse edge
        if self.graph_type == GraphType.UNDIRECTED:
            self._adjacency_list[target.id].append((source.id, weight))
            
        # Track the edge
        edge = Edge(source, target, weight)
        self.edges.add(edge)
        
    def get_neighbors(self, node: Node) -> List[Tuple[Node, float]]:
        """Get all neighbors of a node with their weights"""
        if node.id not in self._adjacency_list:
            return []
            
        result = []
        for neighbor_id, weight in self._adjacency_list[node.id]:
            if neighbor_id in self._node_map:
                result.append((self._node_map[neighbor_id], weight))
                
        return result
    
    def has_node(self, node_id: str) -> bool:
        """Check if a node exists in the graph"""
        return node_id in self._node_map
        
    def get_node(self, node_id: str) -> Optional[Node]:
        """Get a node by its ID"""
        return self._node_map.get(node_id)


# === PATHFINDING ALGORITHMS ===

class PathfindingEngine:
    """Main engine for pathfinding operations with multiple algorithm support"""
    
    def __init__(self, graph: Graph):
        self.graph = graph
        self._heuristic_cache: Dict[str, float] = {}
        
    def find_shortest_path(
        self,
        start_node_id: str,
        end_node_id: str,
        algorithm: PathfindingAlgorithm = PathfindingAlgorithm.DIJKSTRA,
        heuristic_func: Optional[Callable[[Node, Node], float]] = None
    ) -> PathResult:
        """
        Find the shortest path between two nodes using specified algorithm
        
        Args:
            start_node_id: ID of starting node
            end_node_id: ID of target node
            algorithm: Algorithm to use for pathfinding
            heuristic_func: Heuristic function for A* (required for A* algorithm)
            
        Returns:
            PathResult containing the path, weight, and metadata
            
        Raises:
            ValueError: If nodes don't exist or invalid parameters
        """
        # Validate inputs
        if not self.graph.has_node(start_node_id):
            raise ValueError(f"Start node '{start_node_id}' does not exist")
            
        if not self.graph.has_node(end_node_id):
            raise ValueError(f"End node '{end_node_id}' does not exist")
            
        start_node = self.graph.get_node(start_node_id)
        end_node = self.graph.get_node(end_node_id)
        
        # Select algorithm
        if algorithm == PathfindingAlgorithm.DIJKSTRA:
            return self._dijkstra(start_node, end_node)
        elif algorithm == PathfindingAlgorithm.A_STAR:
            if heuristic_func is None:
                raise ValueError("Heuristic function required for A* algorithm")
            return self._a_star(start_node, end_node, heuristic_func)
        elif algorithm == PathfindingAlgorithm.BREADTH_FIRST:
            return self._breadth_first_search(start_node, end_node)
        else:
            raise ValueError(f"Unsupported algorithm: {algorithm}")
    
    def _dijkstra(
        self, 
        start: Node, 
        end: Node
    ) -> PathResult:
        """Dijkstra's algorithm implementation"""
        import time
        
        start_time = time.perf_counter()
        
        # Initialize data structures
        distances: Dict[str, float] = {node.id: float('inf') for node in self.graph.nodes}
        previous: Dict[str, Optional[Node]] = {node.id: None for node in self.graph.nodes}
        visited: Set[str] = set()
        pq: List[Tuple[float, Node]] = [(0, start)]
        
        distances[start.id] = 0
        
        while pq:
            current_distance, current_node = heappop(pq)
            
            if current_node.id in visited:
                continue
                
            visited.add(current_node.id)
            
            # Early termination
            if current_node == end:
                break
                
            # Explore neighbors
            for neighbor, weight in self.graph.get_neighbors(current_node):
                if neighbor.id not in visited:
                    new_distance = distances[current_node.id] + weight
                    
                    if new_distance < distances[neighbor.id]:
                        distances[neighbor.id] = new_distance
                        previous[neighbor.id] = current_node
                        heappush(pq, (new_distance, neighbor))
        
        # Reconstruct path
        path_nodes, path_edges = self._reconstruct_path(previous, start, end)
        total_weight = distances[end.id]
        
        execution_time = (time.perf_counter() - start_time) * 1000
        
        return PathResult(
