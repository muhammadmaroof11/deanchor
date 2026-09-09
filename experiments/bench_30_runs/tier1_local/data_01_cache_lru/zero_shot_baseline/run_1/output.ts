```go
package cache

import (
	"container/list"
	"context"
	"fmt"
	"sync"
	"time"
)

// CacheType represents the type of caching algorithm to use
type CacheType int

const (
	LRU CacheType = iota
	LFU
)

// Entry represents a cached item with metadata
type Entry struct {
	Key       interface{}
	Value     interface{}
	Timestamp time.Time
	Accessed  time.Time
	Frequency int
	Size      int64
}

// CacheMetrics holds performance statistics for the cache
type CacheMetrics struct {
	Hits        uint64
	Misses      uint64
	Evictions   uint64
	TotalSize   int64
	MaxSize     int64
	CurrentSize int64
}

// CacheConfig holds configuration parameters for the cache
type CacheConfig struct {
	Capacity    int64
	MaxAge      time.Duration
	TTL         time.Duration
	Eviction    CacheType
	Metrics     bool
}

// Cache interface defines the contract for all cache implementations
type Cache interface {
	Get(ctx context.Context, key interface{}) (interface{}, error)
	Put(ctx context.Context, key, value interface{}) error
	Delete(ctx context.Context, key interface{}) error
	Contains(ctx context.Context, key interface{}) bool
	Size() int64
	Capacity() int64
	Metrics() *CacheMetrics
	Flush(ctx context.Context) error
	Close() error
}

// LRUCache implements a thread-safe LRU cache with modern Go patterns
type LRUCache struct {
	mu        sync.RWMutex
	data      map[interface{}]*list.Element
	list      *list.List
	config    CacheConfig
	metrics   *CacheMetrics
	evictChan chan *Entry
}

// LFUCache implements a thread-safe LFU cache with modern Go patterns
type LFUCache struct {
	mu        sync.RWMutex
	data      map[interface{}]*list.Element
	list      *list.List
	config    CacheConfig
	metrics   *CacheMetrics
	evictChan chan *Entry
}

// NewLRUCache creates a new LRU cache with the specified configuration
func NewLRUCache(config CacheConfig) (*LRUCache, error) {
	if config.Capacity <= 0 {
		return nil, fmt.Errorf("cache capacity must be positive")
	}
	
	cache := &LRUCache{
		data:      make(map[interface{}]*list.Element),
		list:      list.New(),
		config:    config,
		metrics:   &CacheMetrics{MaxSize: config.Capacity},
		evictChan: make(chan *Entry, 100), // Buffered channel for eviction notifications
	}
	
	go cache.processEvictions()
	return cache, nil
}

// NewLFUCache creates a new LFU cache with the specified configuration
func NewLFUCache(config CacheConfig) (*LFUCache, error) {
	if config.Capacity <= 0 {
		return nil, fmt.Errorf("cache capacity must be positive")
	}
	
	cache := &LFUCache{
		data:      make(map[interface{}]*list.Element),
		list:      list.New(),
		config:    config,
		metrics:   &CacheMetrics{MaxSize: config.Capacity},
		evictChan: make(chan *Entry, 100), // Buffered channel for eviction notifications
	}
	
	go cache.processEvictions()
	return cache, nil
}

// Get retrieves an item from the cache by key
func (c *LRUCache) Get(ctx context.Context, key interface{}) (interface{}, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if elem, exists := c.data[key]; exists {
		entry := elem.Value.(*Entry)
		
		// Check if item has expired based on TTL or MaxAge
		if c.shouldExpire(entry) {
			go func() { c.evictChan <- entry }() // Async eviction
			return nil, fmt.Errorf("cache entry expired")
		}
		
		c.metrics.Hits++
		
		// Move to front (most recently used)
		c.list.MoveToFront(elem)
		entry.Accessed = time.Now()
		
		return entry.Value, nil
	}
	
	c.metrics.Misses++
	return nil, fmt.Errorf("key not found: %v", key)
}

// Put stores an item in the cache
func (c *LRUCache) Put(ctx context.Context, key, value interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry := &Entry{
		Key:       key,
		Value:     value,
		Timestamp: time.Now(),
		Accessed:  time.Now(),
		Size:      int64(len(fmt.Sprintf("%v", value))),
	}

	if elem, exists := c.data[key]; exists {
		// Update existing entry
		oldEntry := elem.Value.(*Entry)
		c.metrics.TotalSize -= oldEntry.Size
		
		entry.Frequency = oldEntry.Frequency + 1
		elem.Value = entry
		
		c.list.MoveToFront(elem)
	} else {
		// Add new entry
		if c.config.Eviction == LRU && len(c.data) >= int(c.config.Capacity) {
			c.evict()
		}
		
		elem := c.list.PushFront(entry)
		c.data[key] = elem
		
		entry.Frequency = 1
	}

	c.metrics.TotalSize += entry.Size
	
	if c.config.Metrics {
		c.updateMetrics()
	}
	
	return nil
}

// Delete removes an item from the cache
func (c *LRUCache) Delete(ctx context.Context, key interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, exists := c.data[key]; exists {
		entry := elem.Value.(*Entry)
		
		delete(c.data, key)
		c.list.Remove(elem)
		
		c.metrics.TotalSize -= entry.Size
		
		return nil
	}
	
	return fmt.Errorf("key not found: %v", key)
}

// Contains checks if a key exists in the cache
func (c *LRUCache) Contains(ctx context.Context, key interface{}) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	_, exists := c.data[key]
	return exists
}

// Size returns the current size of the cache
func (c *LRUCache) Size() int64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	return int64(len(c.data))
}

// Capacity returns the maximum capacity of the cache
func (c *LRUCache) Capacity() int64 {
	return c.config.Capacity
}

// Metrics returns performance metrics for the cache
func (c *LRUCache) Metrics() *CacheMetrics {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	// Return a copy to prevent external modification
	metrics := *c.metrics
	return &metrics
}

// Flush clears all items from the cache
func (c *LRUCache) Flush(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.data = make(map[interface{}]*list.Element)
	c.list.Init()
	c.metrics.TotalSize = 0
	
	if c.config.Metrics {
		c.metrics.Hits = 0
		c.metrics.Misses = 0
		c.metrics.Evictions = 0
	}
	
	return nil
}

// Close cleans up resources and stops background goroutines
func (c *LRUCache) Close() error {
	close(c.evictChan)
	return nil
}

// evict removes the least recently used item from the cache
func (c *LRUCache) evict() {
	if c.list.Len() == 0 {
		return
	}
	
	elem := c.list.Back()
	entry := elem.Value.(*Entry)
	
	delete(c.data, entry.Key)
	c.list.Remove(elem)
	
	c.metrics.Evictions++
	c.metrics.TotalSize -= entry.Size
	
	go func() { c.evictChan <- entry }()
}

// shouldExpire checks if an entry has expired based on configured policies
func (c *LRUCache) shouldExpire(entry *Entry) bool {
	if c.config.TTL > 0 && time.Since(entry.Timestamp) > c.config.TTL {
		return true
	}
	
	if c.config.MaxAge > 0 && time.Since(entry.Accessed) > c.config.MaxAge {
		return true
	}
	
	return false
}

// processEvictions handles background eviction notifications
func (c *LRUCache) processEvictions() {
	for entry := range c.evictChan {
		// Background processing of evicted items if needed
		_ = entry // Placeholder for potential async cleanup operations
	}
}

// Get retrieves an item from the LFU cache by key
func (c *LFUCache) Get(ctx context.Context, key interface{}) (interface{}, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if elem, exists := c.data[key]; exists {
		entry := elem.Value.(*Entry)
		
		// Check if item has expired based on TTL or MaxAge
		if c.shouldExpire(entry) {
			go func() { c.evictChan <- entry }() // Async eviction
			return nil, fmt.Errorf("cache entry expired")
		}
		
		c.metrics.Hits++
		
		// Increment frequency and reposition in list
		entry.Frequency++
		c.repositionEntry(elem)
		
		return entry.Value, nil
	}
	
	c.metrics.Misses++
	return nil, fmt.Errorf("key not found: %v", key)
}

// Put stores an item in the LFU cache
func (c *LFUCache) Put(ctx context.Context, key, value interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry := &Entry{
		Key:      