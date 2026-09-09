```cpp
// Graph Pathfinder Shortest Route - Modern C++23 Implementation
// Domain: Algorithmic & Fintech | Architecture: Clean, Modular, High-Performance

module;

#include <algorithm>
#include <array>
#include <bit>
#include <chrono>
#include <compare>
#include <concepts>
#include <cstddef>
#include <cstdint>
#include <execution>
#include <expected>
#include <format>
#include <functional>
#include <limits>
#include <memory>
#include <numeric>
#include <optional>
#include <queue>
#include <ranges>
#include <span>
#include <string>
#include <string_view>
#include <tuple>
#include <type_traits>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

export module graph.pathfinder;

namespace graph::pathfinder {

// ============================================================================
// Core Types & Concepts
// ============================================================================

using NodeId = std::uint64_t;
using EdgeId = std::uint64_t;
using Weight = double;
using Timestamp = std::chrono::nanoseconds;

constexpr NodeId INVALID_NODE = std::numeric_limits<NodeId>::max();
constexpr EdgeId INVALID_EDGE = std::numeric_limits<EdgeId>::max();
constexpr Weight INF_WEIGHT = std::numeric_limits<Weight>::infinity();
constexpr Weight EPSILON = 1e-12;

struct Coordinate {
    double lat{0.0};
    double lon{0.0};
    
    constexpr auto operator<=>(const Coordinate&) const = default;
    constexpr double distance_to(const Coordinate& other) const noexcept {
        constexpr double R = 6371000.0; // Earth radius in meters
        const double dlat = (other.lat - lat) * M_PI / 180.0;
        const double dlon = (other.lon - lon) * M_PI / 180.0;
        const double a = std::sin(dlat/2) * std::sin(dlat/2) +
                         std::cos(lat * M_PI / 180.0) * std::cos(other.lat * M_PI / 180.0) *
                         std::sin(dlon/2) * std::sin(dlon/2);
        return 2 * R * std::asin(std::sqrt(a));
    }
};

template<typename T>
concept Arithmetic = std::is_arithmetic_v<T>;

template<typename T>
concept NodeLike = requires(T t) {
    { t.id } -> std::convertible_to<NodeId>;
    { t.coordinate } -> std::convertible_to<Coordinate>;
};

template<typename T>
concept EdgeLike = requires(T t) {
    { t.id } -> std::convertible_to<EdgeId>;
    { t.source } -> std::convertible_to<NodeId>;
    { t.target } -> std::convertible_to<NodeId>;
    { t.weight } -> std::convertible_to<Weight>;
};

// ============================================================================
// Graph Data Structures
// ============================================================================

struct Node {
    NodeId id = INVALID_NODE;
    Coordinate coordinate{};
    std::unordered_map<std::string, std::string> attributes{};
    
    constexpr bool valid() const noexcept { return id != INVALID_NODE; }
    constexpr auto operator<=>(const Node&) const = default;
};

struct Edge {
    EdgeId id = INVALID_EDGE;
    NodeId source = INVALID_NODE;
    NodeId target = INVALID_NODE;
    Weight weight = INF_WEIGHT;
    bool directed = true;
    std::unordered_map<std::string, std::string> attributes{};
    
    constexpr bool valid() const noexcept { return id != INVALID_EDGE && weight < INF_WEIGHT; }
    constexpr auto operator<=>(const Edge&) const = default;
};

struct Path {
    std::vector<NodeId> nodes{};
    std::vector<EdgeId> edges{};
    Weight total_weight = INF_WEIGHT;
    Timestamp computation_time{};
    
    constexpr bool valid() const noexcept { return !nodes.empty() && total_weight < INF_WEIGHT; }
    constexpr std::size_t length() const noexcept { return nodes.size(); }
    constexpr std::size_t edge_count() const noexcept { return edges.size(); }
    
    constexpr auto operator<=>(const Path& other) const noexcept {
        return total_weight <=> other.total_weight;
    }
};

// ============================================================================
// Graph Interface
// ============================================================================

class IGraph {
public:
    virtual ~IGraph() = default;
    
    // Node operations
    virtual std::expected<NodeId, std::string> add_node(Node&& node) = 0;
    virtual std::expected<NodeId, std::string> add_node(Coordinate coord) = 0;
    virtual std::optional<Node> get_node(NodeId id) const = 0;
    virtual bool remove_node(NodeId id) = 0;
    virtual bool has_node(NodeId id) const = 0;
    
    // Edge operations
    virtual std::expected<EdgeId, std::string> add_edge(Edge&& edge) = 0;
    virtual std::expected<EdgeId, std::string> add_edge(NodeId src, NodeId dst, Weight w, bool directed = true) = 0;
    virtual std::optional<Edge> get_edge(EdgeId id) const = 0;
    virtual std::optional<Edge> get_edge(NodeId src, NodeId dst) const = 0;
    virtual bool remove_edge(EdgeId id) = 0;
    virtual bool remove_edge(NodeId src, NodeId dst) = 0;
    virtual bool has_edge(NodeId src, NodeId dst) const = 0;
    
    // Topology queries
    virtual std::vector<NodeId> neighbors(NodeId id) const = 0;
    virtual std::vector<EdgeId> outgoing_edges(NodeId id) const = 0;
    virtual std::vector<EdgeId> incoming_edges(NodeId id) const = 0;
    virtual std::span<const EdgeId> outgoing_edges_span(NodeId id) const = 0;
    virtual std::span<const EdgeId> incoming_edges_span(NodeId id) const = 0;
    
    // Graph properties
    virtual std::size_t node_count() const noexcept = 0;
    virtual std::size_t edge_count() const noexcept = 0;
    virtual bool empty() const noexcept = 0;
    virtual void clear() = 0;
    virtual void reserve_nodes(std::size_t n) = 0;
    virtual void reserve_edges(std::size_t n) = 0;
    
    // Bulk operations
    virtual void for_each_node(auto&& func) const = 0;
    virtual void for_each_edge(auto&& func) const = 0;
};

// ============================================================================
// Adjacency List Graph Implementation
// ============================================================================

class AdjacencyListGraph final : public IGraph {
private:
    struct NodeData {
        Node node;
        std::vector<EdgeId> outgoing{};
        std::vector<EdgeId> incoming{};
        bool alive = true;
    };
    
    struct EdgeData {
        Edge edge;
        bool alive = true;
    };
    
    std::vector<NodeData> nodes_;
    std::vector<EdgeData> edges_;
    std::unordered_map<NodeId, std::size_t> node_index_;
    std::unordered_map<EdgeId, std::size_t> edge_index_;
    NodeId next_node_id_ = 0;
    EdgeId next_edge_id_ = 0;
    
    constexpr std::optional<std::size_t> find_node_index(NodeId id) const noexcept {
        auto it = node_index_.find(id);
        return it != node_index_.end() ? std::make_optional(it->second) : std::nullopt;
    }
    
    constexpr std::optional<std::size_t> find_edge_index(EdgeId id) const noexcept {
        auto it = edge_index_.find(id);
        return it != edge_index_.end() ? std::make_optional(it->second) : std::nullopt;
    }
    
    constexpr std::optional<std::size_t> find_edge_index(NodeId src, NodeId dst) const noexcept {
        if (auto src_idx = find_node_index(src); src_idx) {
            for (EdgeId eid : nodes_[*src_idx].outgoing) {
                if (auto e_idx = find_edge_index(eid); e_idx && edges_[*e_idx].alive) {
                    if (edges_[*e_idx].edge.target == dst) return e_idx;
                }
            }
       