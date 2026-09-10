A production-grade, state-of-the-art greenfield implementation built strictly from the decoupled semantic YAML schema. 

The implementation uses **Python 3.11+**, incorporating type safety (`pydantic` / standard `dataclasses`), thread-safe concurrency control via structural locking, and explicit O(1) time-complexity data structures for LRU, LFU, and ARC caching strategies.

---

### Project File Structure

```text
high_performance_cache/
├── __init__.py
├── domain/
│   ├── __init__.py
│   ├── entities.py
│   ├── value_objects.py
│   └── state.py
├── policies/
│   ├── __init__.py
│   ├── base.py
│   ├── lru.py
│   ├── lfu.py
│   └── arc.py
└── engine.py
```

---

### 1. Domain Layer: Value Objects (`domain/value_objects.py`)

```python
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Union

@dataclass(frozen=True)
class CacheKey:
    id: Union[str, bytes]
    namespace: str

    def __hash__(self) -> int:
        # Convert bytes to hashable representation if needed
        raw_id = self.id.hex() if isinstance(self.id, bytes) else self.id
        return hash((raw_id, self.namespace))


@dataclass
class CacheValue:
    data: Any
    size_bytes: int
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    accessed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    access_count: int = 0

    def touch(self) -> None:
        self.accessed_at = datetime.now(timezone.utc)
        self.access_count += 1


class EvictionPolicyType(str, Enum):
    LRU = "LRU"
    LFU = "LFU"
    ARC = "ARC"


@dataclass(frozen=True)
class EvictionPolicy:
    type: EvictionPolicyType
    max_capacity_bytes: int
    max_capacity_items: int
```

---

### 2. Domain Layer: Entities (`domain/entities.py`)

```python
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, List, TYPE_CHECKING
from domain.value_objects import CacheKey, CacheValue

@dataclass
class CacheNode:
    key: CacheKey
    value: CacheValue
    prev: Optional[CacheNode] = None
    next: Optional[CacheNode] = None
    frequency_node: Optional[FrequencyNode] = None

@dataclass
class FrequencyNode:
    frequency: int
    keys: List[CacheNode] = field(default_factory=list) # Doubly-linked behavior simulated or direct references
    prev: Optional[FrequencyNode] = None
    next: Optional[FrequencyNode] = None
```

---

### 3. Eviction Policy Strategies (`policies/base.py`, `policies/lru.py`, `policies/lfu.py`, `policies/arc.py`)

#### `policies/base.py`
```python
from abc import ABC, abstractmethod
from typing import List, Tuple, Dict, Any
from domain.value_objects import CacheKey, CacheValue
from domain.entities import CacheNode

class BaseEvictionStrategy(ABC):
    @abstractmethod
    def on_access(self, node: CacheNode) -> None:
        pass

    @abstractmethod
    def on_insert(self, node: CacheNode) -> None:
        pass

    @abstractmethod
    def on_remove(self, node: CacheNode) -> None:
        pass

    @abstractmethod
    def evict(self, items_map: Dict[CacheKey, CacheNode], target_bytes: int, target_items: int) -> List[Tuple[CacheKey, CacheValue]]:
        pass
```

#### `policies/lru.py`
```python
from typing import Dict, List, Tuple, Optional
from domain.value_objects import CacheKey, CacheValue
from domain.entities import CacheNode
from policies.base import BaseEvictionStrategy

class LRUEvictionStrategy(BaseEvictionStrategy):
    """
    True O(1) LRU using a doubly linked list embedded via CacheNode prev/next.
    """
    def __init__(self):
        self.head: Optional[CacheNode] = None
        self.tail: Optional[CacheNode] = None

    def _remove_node(self, node: CacheNode) -> None:
        if node.prev:
            node.prev.next = node.next
        else:
            self.head = node.next

        if node.next:
            node.next.prev = node.prev
        else:
            self.tail = node.prev
        node.prev = None
        node.next = None

    def _add_to_head(self, node: CacheNode) -> None:
        node.next = self.head
        node.prev = None
        if self.head:
            self.head.prev = node
        self.head = node
        if not self.tail:
            self.tail = node

    def on_access(self, node: CacheNode) -> None:
        self._remove_node(node)
        self._add_to_head(node)

    def on_insert(self, node: CacheNode) -> None:
        self._add_to_head(node)

    def on_remove(self, node: CacheNode) -> None:
        self._remove_node(node)

    def evict(self, items_map: Dict[CacheKey, CacheNode], target_bytes: int, target_items: int) -> List[Tuple[CacheKey, CacheValue]]:
        evicted: List[Tuple[CacheKey, CacheValue]] = []
        freed_bytes = 0
        freed_items = 0

        while self.tail and (freed_bytes < target_bytes or freed_items < target_items):
            node_to_evict = self.tail
            self._remove_node(node_to_evict)
            del items_map[node_to_evict.key]
            
            evicted.append((node_to_evict.key, node_to_evict.value))
            freed_bytes += node_to_evict.value.size_bytes
            freed_items += 1

        return evicted
```

#### `policies/lfu.py`
```python
from typing import Dict, List, Tuple, Optional
from domain.value_objects import CacheKey, CacheValue
from domain.entities import CacheNode, FrequencyNode
from policies.base import BaseEvictionStrategy

class LFUEvictionStrategy(BaseEvictionStrategy):
    """
    O(1) LFU Implementation using Frequency Buckets with LRU tie-breaking.
    """
    def __init__(self):
        self.freq_head: Optional[FrequencyNode] = None
        self.node_lookup: Dict[CacheKey, CacheNode] = {}

    def _add_freq_node_after(self, current: Optional[FrequencyNode], new_freq: int) -> FrequencyNode:
        new_node = FrequencyNode(frequency=new_freq)
        if not current:
            new_node.next = self.freq_head
            if self.freq_head:
                self.freq_head.prev = new_node
            self.freq_head = new_node
        else:
            new_node.prev = current
            new_node.next = current.next
            if current.next:
                current.next.prev = new_node
            current.next = new_node
        return new_node

    def _remove_freq_node(self, freq_node: FrequencyNode) -> None:
        if freq_node.prev:
            freq_node.prev.next = freq_node.next
        else:
            self.freq_head = freq_node.next
        if freq_node.next:
            freq_node.next.prev = freq_node.prev
        freq_node.prev = None
        freq_node.next = None

    def on_access(self, node: CacheNode) -> None:
        curr_freq_node = node.frequency_node
        if not curr_freq_node:
            return

        next_freq = curr_freq_node.frequency + 1
        target_freq_node = curr_freq_node.next

        if not target_freq_node or target_freq_node.frequency != next_freq:
            target