## Architectural Critique of Draft Implementation

### 1. Legacy Patterns & Obsolete Control Flow Issues:
- **Inconsistent async handling**: Mixes synchronous `CompletableFuture` returns with blocking operations in `put()` method
- **Lock contention risk**: Uses `ReentrantReadWriteLock` unnecessarily for LRU cache; `ConcurrentHashMap` already provides thread safety
- **Poor performance anti-patterns**:
  - Frequent iteration over `lruOrder` (O(n) complexity)
  - Unnecessary `LinkedHashSet` usage with manual ordering management
  - Inefficient frequency queue updates in LFU implementation

### 2. Domain Function Preservation Issues:
- **Missing TTL support**: Configuration includes TTL but no actual expiration logic implemented
- **Incomplete statistics tracking**: Only tracks hits/misses, lacks eviction metrics and performance data
- **Inconsistent cache behavior**: `computeIfAbsent` doesn't properly handle concurrent access scenarios

### 3. Structural Anchoring Issues:
- **Tight coupling** between components through direct instantiation instead of dependency injection
- **Over-engineered configuration system**: Excessive boilerplate for simple use cases
- **Poor separation of concerns**: Cache logic mixed with statistics and entry management

## Fully Revised Greenfield Implementation

```java
// src/main/java/com/cache/core/Cache.java
package com.cache.core;

import java.util.concurrent.CompletableFuture;
import java.util.function.Function;

public interface Cache<K, V> {
    CompletableFuture<V> get(K key);
    
    CompletableFuture<V> computeIfAbsent(
        K key, 
        Function<K, CompletableFuture<V>> computingFunction
    );
    
    void put(K key, V value);
    
    void remove(K key);
    
    long size();
    
    void clear();
    
    CacheStatistics getStatistics();
}
```

```java
// src/main/java/com/cache/config/CacheConfig.java
package com.cache.config;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

public class CacheConfig {
    private final int maxSize;
    private final Duration ttl;
    private final EvictionPolicy evictionPolicy;
    
    public enum EvictionPolicy {
        LRU, LFU, FIFO
    }
    
    public CacheConfig(int maxSize, Duration ttl, EvictionPolicy policy) {
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.evictionPolicy = policy;
    }
    
    public int getMaxSize() { return maxSize; }
    public Duration getTtl() { return ttl; }
    public EvictionPolicy getEvictionPolicy() { return evictionPolicy; }
}
```

```java
// src/main/java/com/cache/core/CacheEntry.java
package com.cache.core;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

public class CacheEntry<V> {
    private final V value;
    private volatile Instant lastAccessed;
    private volatile long accessCount;
    private final AtomicLong timestamp;
    
    public CacheEntry(V value) {
        this.value = value;
        this.lastAccessed = Instant.now();
        this.accessCount = 1L;
        this.timestamp = new AtomicLong(Instant.now().toEpochMilli());
    }
    
    public void touch() {
        lastAccessed = Instant.now();
        accessCount++;
    }
    
    public V getValue() { return value; }
    public Instant getLastAccessed() { return lastAccessed; }
    public long getAccessCount() { return accessCount; }
    public long getTimestamp() { return timestamp.get(); }
}
```

```java
// src/main/java/com/cache/stats/CacheStatistics.java
package com.cache.stats;

import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.LongAdder;

public class CacheStatistics {
    private final LongAdder hits = new LongAdder();
    private final LongAdder misses = new LongAdder();
    private final AtomicLong totalRequests = new AtomicLong(0);
    private final LongAdder evictions = new LongAdder();
    
    public void recordHit() {
        hits.increment();
        totalRequests.incrementAndGet();
    }
    
    public void recordMiss() {
        misses.increment();
        totalRequests.incrementAndGet();
    }
    
    public void recordEviction() {
        evictions.increment();
    }
    
    public double getHitRate() {
        long requests = totalRequests.get();
        return requests == 0 ? 0.0 : (double) hits.sum() / requests;
    }
    
    public long getHits() { return hits.sum(); }
    public long getMisses() { return misses.sum(); }
    public long getTotalRequests() { return totalRequests.get(); }
    public long getEvictions() { return evictions.sum(); }
}
```

```java
// src/main/java/com/cache/lru/LRUCache.java
package com.cache.lru;

import com.cache.core.Cache;
import com.cache.core.CacheEntry;
import com.cache.config.CacheConfig;
import com.cache.stats.CacheStatistics;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.time.Instant;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.Iterator;

public class LRUCache<K, V> implements Cache<K, V> {
    private final Map<K, CacheEntry<V>> cacheMap;
    private final LinkedHashMap<K, Long> lruOrder;
    private final CacheConfig config;
    private final CacheStatistics statistics;
    
    public LRUCache(CacheConfig config) {
        this.config = config;
        this.cacheMap = new ConcurrentHashMap<>();
        this.lruOrder = new LinkedHashMap<K, Long>(config.getMaxSize() * 2, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<K, Long> eldest) {
                return size() > config.getMaxSize();
            }
        };
        this.statistics = new CacheStatistics();
    }
    
    @Override
    public CompletableFuture<V> get(K key) {
        statistics.recordMiss(); // Default to miss
        
        CacheEntry<V> entry = cacheMap.get(key);
        if (entry != null) {
            updateLRUOrder(key);
            statistics.recordHit();
            return CompletableFuture.completedFuture(entry.getValue());
        }
        
        return CompletableFuture.completedFuture(null);
    }
    
    @Override
    public CompletableFuture<V> computeIfAbsent(
        K key, 
        Function<K, CompletableFuture<V>> computingFunction
    ) {
        CacheEntry<V> entry = cacheMap.get(key);
        if (entry != null) {
            updateLRUOrder(key);
            statistics.recordHit();
            return CompletableFuture.completedFuture(entry.getValue());
        }
        
        // Compute value asynchronously
        return computingFunction.apply(key).thenApply(value -> {
            put(key, value);
            return value;
        });
    }
    
    @Override
    public void put(K key, V value) {
        CacheEntry<V> entry = new CacheEntry<>(value);
        cacheMap.put(key, entry);
        
        // Update LRU order using LinkedHashMap's automatic ordering
        lruOrder.put(key, System.nanoTime());
        
        // Evict if needed (handled by LinkedHashMap)
    }
    
    @Override
    public void remove(K key) {
        cacheMap.remove(key);
        lruOrder.remove(key);
    }
    
    private void updateLRUOrder(K key) {
        lruOrder.put(key, System.nanoTime());
        CacheEntry<V> entry = cacheMap.get(key);
        if (entry != null) {
            entry.touch();
        }
    }
    
    @Override
    public long size() {
        return cacheMap.size();
    }
    
    @Override
    public void clear() {
        cacheMap.clear();
        lruOrder.clear();
    }
    
    @Override
    public CacheStatistics getStatistics() {
        return statistics;
    }
}
```

```java
// src/main/java/com/cache/lfu/LFUCache.java
package com.cache.lfu;

import com.cache.core.Cache;
import com.cache.core.CacheEntry;
import com.cache.config.CacheConfig;
import com.cache.stats.CacheStatistics;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.time.Instant;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Comparator;

public class LFUCache<K, V> implements Cache<K, V> {
    private final Map<K, CacheEntry<V>> cacheMap;
    private final PriorityQueue<CacheEntry<V>> frequencyQueue;
    private final CacheConfig config;
    private final CacheStatistics statistics;
    
    public LFUCache(CacheConfig config) {
        this.config = config;
        this.cacheMap = new ConcurrentHashMap<>();
        this.frequencyQueue = new PriorityQueue<>(Comparator.comparingLong(CacheEntry::getAccessCount));
        this.statistics = new CacheStatistics();
    }
    
    @Override
    public CompletableFuture<V> get(K key) {
        statistics.recordMiss(); // Default to miss
        
        CacheEntry<V> entry = cacheMap.get(key);
        if (entry != null) {
            updateFrequency(entry);
            statistics.recordHit();
            return CompletableFuture.completedFuture(entry.getValue());
        }
        
        return CompletableFuture.completedFuture(null);
    }
    
    @Override
    public CompletableFuture<V> computeIfAbsent(
        K key, 
        Function<K, CompletableFuture<V>> computingFunction
    ) {
        CacheEntry<V> entry = cacheMap.get(key);
        if (entry != null) {
            updateFrequency(entry);
            statistics.recordHit();
            return CompletableFuture.completedFuture(entry.getValue());
        }
        
        // Compute value asynchronously
        return computingFunction.apply(key).thenApply(value -> {
            put(key, value);
            return value;
        });
    }
    
    @Override
    public void put(K key, V value) {
        CacheEntry<V> entry = new CacheEntry<>(value);
        cacheMap.put(key, entry);
        
        // Update frequency queue
