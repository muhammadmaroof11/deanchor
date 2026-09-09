# Modern Graph Pathfinding Implementation

I'll create a clean, modern architecture for graph pathfinding with focus on performance, maintainability, and extensibility. Let me think through this step by step.

## Analysis of Requirements
- Need to implement shortest path algorithms (Dijkstra's, A*, etc.)
- Should be efficient for fintech applications where performance matters
- Must support various graph types and edge weights
- Clean architecture with separation of concerns
- Modern C++ features and best practices

## Core Design Principles
1. **Separation of Concerns**: Algorithms separate from data structures
2. **Generic Programming**: Support different node/edge types
3. **Performance**: Efficient memory usage, cache-friendly access patterns
4. **Extensibility**: Easy to add new algorithms or graph representations
5. **Type Safety**: Compile-time guarantees through templates and concepts

## Implementation Plan

```cpp
// Modern Graph Pathfinding Library - Clean Architecture Approach
#ifndef GRAPH_PATHFINDING_H
#define GRAPH_PATHFINDING_H

#include <vector>
#include <queue>
#include <unordered_map>
#include <functional>
#include <optional>
#include <algorithm>
#include <limits>
#include <memory>

namespace graph_pathfinder {

// Forward declarations for clean interfaces
template<typename NodeId, typename Weight>
class Graph;

template<typename NodeId, typename Weight>
struct PathResult {
    std::vector<NodeId> path;
    Weight total_weight;
    bool found;
    
    PathResult() : total_weight(0), found(false) {}
    PathResult(std::vector<NodeId> p, Weight w, bool f) 
        : path(std::move(p)), total_weight(w), found(f) {}
};

// Node identifier concept - can be any hashable type
template<typename T>
concept NodeIdentifier = requires(T t) {
    { std::hash<T>{}(t) } -> std::convertible_to<std::size_t>;
};

// Weight concept - must support arithmetic operations
template<typename T>
concept WeightType = requires(T a, T b) {
    { a + b } -> std::same_as<T>;
    { a - b } -> std::same_as<T>;
    { a < b } -> std::convertible_to<bool>;
};

// Core graph interface
template<NodeIdentifier NodeId, WeightType Weight>
class Graph {
private:
    struct Edge {
        NodeId target;
        Weight weight;
        
        bool operator<(const Edge& other) const {
            return weight > other.weight; // For priority queue (min-heap)
        }
    };
    
    std::unordered_map<NodeId, std::vector<Edge>> adjacency_list_;
    std::unordered_map<NodeId, NodeId> node_metadata_; // Optional metadata storage
    
public:
    void add_node(const NodeId& node) {
        if (adjacency_list_.find(node) == adjacency_list_.end()) {
            adjacency_list_[node] = {};
        }
    }
    
    void add_edge(const NodeId& source, const NodeId& target, Weight weight) {
        // Ensure both nodes exist
        add_node(source);
        add_node(target);
        
        adjacency_list_[source].push_back({target, weight});
    }
    
    void remove_edge(const NodeId& source, const NodeId& target) {
        auto it = adjacency_list_.find(source);
        if (it != adjacency_list_.end()) {
            it->second.erase(
                std::remove_if(it->second.begin(), it->second.end(),
                    [&target](const Edge& e) { return e.target == target; }),
                it->second.end()
            );
        }
    }
    
    const std::vector<Edge>& get_neighbors(const NodeId& node) const {
        static const std::vector<Edge> empty;
        auto it = adjacency_list_.find(node);
        return (it != adjacency_list_.end()) ? it->second : empty;
    }
    
    bool has_node(const NodeId& node) const {
        return adjacency_list_.find(node) != adjacency_list_.end();
    }
    
    size_t num_nodes() const { return adjacency_list_.size(); }
    size_t num_edges() const {
        size_t count = 0;
        for (const auto& pair : adjacency_list_) {
            count += pair.second.size();
        }
        return count;
    }
};

// Pathfinding algorithm interface
template<NodeIdentifier NodeId, WeightType Weight>
class PathFinder {
public:
    virtual ~PathFinder() = default;
    
    // Find shortest path from source to target
    virtual PathResult<NodeId, Weight> find_path(
        const Graph<NodeId, Weight>& graph,
        const NodeId& source,
        const NodeId& target) const = 0;
};

// Dijkstra's algorithm implementation
template<NodeIdentifier NodeId, WeightType Weight>
class DijkstraPathFinder : public PathFinder<NodeId, Weight> {
private:
    // Helper to get minimum distance from priority queue
    template<typename T>
    static std::optional<T> extract_min(std::priority_queue<T>& pq) {
        if (pq.empty()) return {};
        auto value = pq.top();
        pq.pop();
        return value;
    }

public:
    PathResult<NodeId, Weight> find_path(
        const Graph<NodeId, Weight>& graph,
        const NodeId& source,
        const NodeId& target) const override {
        
        // Initialize data structures
        std::unordered_map<NodeId, Weight> distances;
        std::unordered_map<NodeId, NodeId> previous;
        std::priority_queue<std::pair<Weight, NodeId>> pq;
        std::unordered_set<NodeId> visited;
        
        // Set initial state
        distances[source] = Weight{0};
        pq.push({Weight{0}, source});
        
        while (!pq.empty()) {
            auto [current_distance, current_node] = pq.top();
            pq.pop();
            
            if (visited.count(current_node)) continue;
            visited.insert(current_node);
            
            // Early termination if we found our target
            if (current_node == target) break;
            
            // Explore neighbors
            for (const auto& edge : graph.get_neighbors(current_node)) {
                NodeId neighbor = edge.target;
                Weight new_distance = current_distance + edge.weight;
                
                // If we found a shorter path to this node
                if (!distances.count(neighbor) || 
                    new_distance < distances[neighbor]) {
                    
                    distances[neighbor] = new_distance;
                    previous[neighbor] = current_node;
                    pq.push({new_distance, neighbor});
                }
            }
        }
        
        // Reconstruct path if found
        PathResult<NodeId, Weight> result;
        if (distances.count(target)) {
            result.total_weight = distances[target];
            result.found = true;
            
            NodeId current = target;
            while (current != source) {
                result.path.push_back(current);
                auto it = previous.find(current);
                if (it == previous.end()) break; // Should not happen in valid graph
                current = it->second;
            }
            result.path.push_back(source);
            std::reverse(result.path.begin(), result.path.end());
        }
        
        return result;
    }
};

// A* algorithm implementation with heuristic support
template<NodeIdentifier NodeId, WeightType Weight>
class AStarPathFinder : public PathFinder<NodeId, Weight> {
private:
    // Heuristic function - must be admissible (never overestimate)
    std::function<Weight(const NodeId&, const NodeId&)> heuristic_;
    
public:
    explicit AStarPathFinder(
        std::function<Weight(const NodeId&, const NodeId&)> heuristic)
        : heuristic_(std::move(heuristic)) {}
    
    PathResult<NodeId, Weight> find_path(
        const Graph<NodeId, Weight>& graph,
        const NodeId& source,
        const NodeId& target) const override {
        
        // Initialize data structures
        std::unordered_map<NodeId, Weight> g_scores;  // Cost from start to node
        std::unordered_map<NodeId, Weight> f_scores;  // Estimated total cost
        std::unordered_map<NodeId, NodeId> previous;
        std::priority_queue<std::pair<Weight, NodeId>> open_set;  // Min-heap
        std::unordered_set<NodeId> closed_set;
        
        g_scores[source] = Weight{0};
        f_scores[source] = heuristic_(source, target);
        open_set.push({f_scores[source], source});
        
        while (!open_set.empty()) {
            auto [current_f_score, current_node] = open_set.top();
            open_set.pop();
            
            if (current_node == target) {
                // Reconstruct path
                PathResult<NodeId, Weight> result;
                result.total_weight = g_scores[target];
                result.found = true;
                
                NodeId node = target;
                while (node != source) {
                    result.path.push_back(node);
                    auto it = previous.find(node);
                    if (it == previous.end()) break;
                    node = it->second;
                }
                result.path.push_back(source);
                std::reverse(result.path.begin(), result.path.end());
                
                return result;
            }
            
            closed_set.insert(current_node);
            
            // Explore neighbors
            for (const auto& edge : graph.get_neighbors(current_node)) {
                NodeId neighbor = edge.target;
                
                if (closed_set.count(neighbor)) continue;
                
                Weight tentative_g_score = g_scores[current_node] + edge.weight;
                
                bool is_better = false;
                if (!g_scores.count(neighbor)) {
                    // First time visiting this node
                    g_scores[neighbor] = tentative_g_score;
                    f_scores[neighbor] = g_scores[neighbor] + heuristic_(neighbor, target);
                    open_set.push({f_scores[neighbor