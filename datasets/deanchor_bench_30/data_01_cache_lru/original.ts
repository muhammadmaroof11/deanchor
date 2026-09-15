/**
 * LRU Cache with TTL Eviction
 * Origin: isaacs/node-lru-cache
 * Doubly-linked list with hash map lookup for O(1) get/set operations.
 */

export interface LRUNode<K, V> {
  key: K;
  value: V;
  expires: number;
  prev: LRUNode<K, V> | null;
  next: LRUNode<K, V> | null;
}

export interface LRUOptions {
  max: number;
  ttl?: number;
}

export class LRUCache<K, V> {
  private max: number;
  private ttl: number;
  private size: number = 0;
  private map: Map<K, LRUNode<K, V>> = new Map();
  private head: LRUNode<K, V> | null = null;
  private tail: LRUNode<K, V> | null = null;

  constructor(options: LRUOptions) {
    if (options.max <= 0) throw new TypeError("max must be positive");
    this.max = options.max;
    this.ttl = options.ttl || 0;
  }

  get(key: K): V | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;

    if (this.ttl > 0 && Date.now() > node.expires) {
      this.delete(key);
      return undefined;
    }

    this.detach(node);
    this.attach(node);
    return node.value;
  }

  set(key: K, value: V, ttlOverride?: number): this {
    const existing = this.map.get(key);
    const ttl = ttlOverride !== undefined ? ttlOverride : this.ttl;
    const expires = ttl > 0 ? Date.now() + ttl : Infinity;

    if (existing) {
      existing.value = value;
      existing.expires = expires;
      this.detach(existing);
      this.attach(existing);
      return this;
    }

    if (this.size >= this.max && this.tail) {
      this.delete(this.tail.key);
    }

    const node: LRUNode<K, V> = {
      key,
      value,
      expires,
      prev: null,
      next: null
    };

    this.attach(node);
    this.map.set(key, node);
    this.size++;
    return this;
  }

  delete(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;

    this.detach(node);
    this.map.delete(key);
    this.size--;
    return true;
  }

  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

  private attach(node: LRUNode<K, V>): void {
    node.next = this.head;
    node.prev = null;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
  }

  private detach(node: LRUNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    node.prev = null;
    node.next = null;
  }
}
