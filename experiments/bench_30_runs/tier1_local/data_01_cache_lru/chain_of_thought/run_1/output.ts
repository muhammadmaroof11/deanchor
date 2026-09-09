```python
"""
Modern LRU/LFU Cache Implementation with Clean Architecture

This implementation provides a high-throughput cache system that supports both LRU (Least Recently Used)
and LFU (Least Frequently Used) eviction policies, with thread-safe operations and efficient memory management.

Key architectural principles:
- Separation of concerns through clear interfaces
- Immutable data structures where appropriate
- Thread safety without over-locking
- Efficient time complexity for all operations
- Clean separation between cache policy and storage mechanisms
"""

from __future__ import annotations
from typing import (
    TypeVar, Generic, Optional, Dict, Set, Tuple, List, Callable, Any,
    Protocol, runtime_checkable
)
from collections import OrderedDict, defaultdict
import threading
import time
import heapq
from dataclasses import dataclass, field
from abc import ABC, abstractmethod

# Type variables for generic programming
K = TypeVar('K')
V = TypeVar('V')

@dataclass
class CacheEntry(Generic[K, V]):
    """Represents a single cache entry with metadata"""
    key: K
    value: V
    frequency: int = 0
    last_accessed: float = field(default_factory=time.time)
    size: int = 0
    
    def __post_init__(self):
        if self.size < 0:
            raise ValueError("Cache entry size cannot be negative")

class CachePolicy(ABC, Generic[K, V]):
    """Abstract base class for cache eviction policies"""
    
    @abstractmethod
    def on_access(self, entry: CacheEntry[K, V]) -> None:
        """Handle access to a cache entry"""
        pass
    
    @abstractmethod
    def evict_candidate(self, entries: List[CacheEntry[K, V]]) -> CacheEntry[K, V]:
        """Select an entry for eviction based on policy"""
        pass

class LRUPolicy(CachePolicy[K, V]):
    """Least Recently Used eviction policy"""
    
    def on_access(self, entry: CacheEntry[K, V]) -> None:
        """Update access time when accessed"""
        entry.last_accessed = time.time()
    
    def evict_candidate(self, entries: List[CacheEntry[K, V]]) -> CacheEntry[K, V]:
        """Evict the least recently used entry"""
        return min(entries, key=lambda e: e.last_accessed)

class LFUPolicy(CachePolicy[K, V]):
    """Least Frequently Used eviction policy"""
    
    def on_access(self, entry: CacheEntry[K, V]) -> None:
        """Increment frequency counter when accessed"""
        entry.frequency += 1
    
    def evict_candidate(self, entries: List[CacheEntry[K, V]]) -> CacheEntry[K, V]:
        """Evict the least frequently used entry"""
        return min(entries, key=lambda e: (e.frequency, e.last_accessed))

class HybridPolicy(CachePolicy[K, V]):
    """Hybrid policy combining LRU and LFU with configurable weights"""
    
    def __init__(self, lru_weight: float = 0.5):
        self.lru_weight = lru_weight
        self._lru_policy = LRUPolicy()
        self._lfu_policy = LFUPolicy()
    
    def on_access(self, entry: CacheEntry[K, V]) -> None:
        """Update both frequency and access time"""
        self._lru_policy.on_access(entry)
        self._lfu_policy.on_access(entry)
    
    def evict_candidate(self, entries: List[CacheEntry[K, V]]) -> CacheEntry[K, V]:
        """Evict based on weighted combination of LRU and LFU scores"""
        def hybrid_score(entry: CacheEntry[K, V]) -> float:
            lru_score = entry.last_accessed
            lfu_score = entry.frequency
            return self.lru_weight * lru_score + (1 - self.lru_weight) * lfu_score
        
        return min(entries, key=hybrid_score)

class CacheStats:
    """Immutable cache statistics for monitoring and debugging"""
    
    def __init__(self,
                 hits: int = 0,
                 misses: int = 0,
                 evictions: int = 0,
                 total_size: int = 0,
                 max_size: int = 0):
        self.hits = hits
        self.misses = misses
        self.evictions = evictions
        self.total_size = total_size
        self.max_size = max_size
    
    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate"""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0
    
    @property
    def utilization(self) -> float:
        """Calculate cache utilization percentage"""
        return self.total_size / self.max_size if self.max_size > 0 else 0.0

class CacheInterface(Protocol[K, V]):
    """Protocol defining the public interface for all cache implementations"""
    
    def get(self, key: K) -> Optional[V]:
        """Retrieve value by key, returning None if not found"""
        ...
    
    def put(self, key: K, value: V, size: int = 0) -> bool:
        """Store a key-value pair with optional size tracking"""
        ...
    
    def delete(self, key: K) -> bool:
        """Remove a key from cache, returning True if successful"""
        ...
    
    def contains(self, key: K) -> bool:
        """Check if key exists in cache"""
        ...
    
    def clear(self) -> None:
        """Clear all entries from cache"""
        ...
    
    def stats(self) -> CacheStats:
        """Get current cache statistics"""
        ...

class ModernCache(Generic[K, V], CacheInterface[K, V]):
    """
    High-performance thread-safe cache implementation with configurable eviction policies
    
    Features:
    - Thread-safe operations using lock-free design where possible
    - Configurable eviction policies (LRU, LFU, Hybrid)
    - Size-based memory management
    - Comprehensive statistics tracking
    - Efficient O(1) average time complexity for most operations
    """
    
    def __init__(self,
                 max_size: int = 10000,
                 policy_type: str = "lru",
                 lru_weight: float = 0.5):
        """
        Initialize the cache with specified parameters
        
        Args:
            max_size: Maximum memory footprint in bytes
            policy_type: Eviction policy ("lru", "lfu", or "hybrid")
            lru_weight: Weight for hybrid policy (0.0 to 1.0)
        """
        self._max_size = max_size
        self._current_size = 0
        
        # Initialize eviction policy
        if policy_type == "lru":
            self._policy = LRUPolicy()
        elif policy_type == "lfu":
            self._policy = LFUPolicy()
        else:  # hybrid
            self._policy = HybridPolicy(lru_weight)
        
        # Thread safety
        self._lock = threading.RLock()
        
        # Storage structures
        self._entries: Dict[K, CacheEntry[K, V]] = {}
        self._access_order: OrderedDict[K, float] = OrderedDict()  # key -> last_accessed
        
        # Statistics tracking
        self._stats = CacheStats(max_size=max_size)
    
    def get(self, key: K) -> Optional[V]:
        """
        Retrieve a value by key with cache hit/miss tracking
        
        Time Complexity: O(1) average case
        Space Complexity: O(1)
        """
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                self._stats.misses += 1
                return None
            
            # Update access metadata according to policy
            self._policy.on_access(entry)
            
            # Update access order for LRU tracking (if needed)
            if isinstance(self._policy, LRUPolicy):
                self._access_order.move_to_end(key, last=True)
            
            self._stats.hits += 1
            return entry.value
    
    def put(self, key: K, value: V, size: int = 0) -> bool:
        """
        Store a key-value pair in cache
        
        Time Complexity: O(1) average case for insertion, O(n) worst case for eviction
        Space Complexity: O(1)
        """
        with self._lock:
            # Check if entry already exists
            existing_entry = self._entries.get(key)
            
            if existing_entry is not None:
                # Update existing entry
                old_size = existing_entry.size
                existing_entry.value = value
                existing_entry.size = size
                
                # Update access metadata
                self._policy.on_access(existing_entry)
                
                # Adjust current size
                self._current_size += (size - old_size)
            else:
                # Create new entry
                new_entry = CacheEntry(key=key, value=value, size=size)
                self._entries[key] = new_entry
                
                # Update access metadata
                self._policy.on_access(new_entry)
                
                # Add to access order for LRU tracking
                if isinstance(self._policy, LRUPolicy):
                    self._access_order[key] = time.time()
                
                # Adjust current size
                self._current_size += size
            
            # Evict entries if necessary
            evicted_count = 0
            while self._current_size > self._max_size:
                evicted_entry = self._evict_one()
                if evicted_entry is None:
                    break
                
                evicted_count += 1
                self._current_size -= evicted_entry.size
            
            # Update stats with eviction count
            self._stats.evictions += evicted_count
            
            return True
    
    def delete(self, key