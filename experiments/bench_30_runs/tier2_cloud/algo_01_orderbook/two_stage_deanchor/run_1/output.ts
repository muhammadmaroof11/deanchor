# Order Book Trading Engine - Greenfield Implementation

Based on the domain schema, I'll create a production-grade, event-sourced order book engine with clean architecture.

## Architecture Overview

```
src/
├── domain/                    # Pure domain logic (no external deps)
│   ├── value-objects/         # Price, Quantity, OrderId, etc.
│   ├── entities/              # OrderBook, OrderSide, OrderQueue, Orders
│   ├── events/                # Domain events for event sourcing
│   ├── services/              # Domain services (matching engine)
│   └── exceptions/            # Domain exceptions
├── application/               # Use cases & application services
│   ├── commands/              # Command handlers
│   ├── queries/               # Query handlers
│   ├── ports/                 # Interfaces (persistence, clock, etc.)
│   └── dto/                   # Data transfer objects
├── infrastructure/            # External adapters
│   ├── persistence/           # Snapshot store, journal store
│   ├── journaling/            # Event sourcing implementation
│   └── clock/                 # System clock implementation
├── presentation/              # API layer
│   ├── rest/                  # REST controllers
│   └── websocket/             # Real-time feeds
└── shared/                    # Kernel utilities
    ├── types/                 # Branded types, Result monad
    └── utils/                 # Helpers
```

---

## 1. Shared Kernel & Value Objects

```typescript
// src/shared/types/branded.ts
export type Brand<T, B> = T & { __brand: B };

export type OrderId = Brand<string, 'OrderId'>;
export type AccountId = Brand<string, 'AccountId'>;
export type OperationId = Brand<bigint, 'OperationId'>;
export type Price = Brand<number, 'Price'>;
export type Quantity = Brand<number, 'Quantity'>;
export type Timestamp = Brand<number, 'Timestamp'>;

export const createOrderId = (id: string): OrderId => id as OrderId;
export const createAccountId = (id: string): AccountId => id as AccountId;
export const createOperationId = (id: bigint): OperationId => id as OperationId;
export const createPrice = (price: number): Price => {
  if (price <= 0 || !Number.isFinite(price)) throw new Error('Invalid price');
  return price as Price;
};
export const createQuantity = (qty: number): Quantity => {
  if (qty <= 0 || !Number.isFinite(qty)) throw new Error('Invalid quantity');
  return qty as Quantity;
};
export const createTimestamp = (ts: number): Timestamp => ts as Timestamp;
```

```typescript
// src/shared/types/result.ts
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const mapResult = <T, U, E>(result: Result<T, E>, fn: (t: T) => U): Result<U, E> =>
  result.ok ? Ok(fn(result.value)) : result;

export const flatMapResult = <T, U, E>(
  result: Result<T, E>, 
  fn: (t: T) => Result<U, E>
): Result<U, E> => result.ok ? fn(result.value) : result;
```

```typescript
// src/shared/utils/collections.ts
export class PriceTree<T> {
  private tree: Map<Price, T> = new Map();
  private sortedPrices: Price[] = [];
  private readonly isDescending: boolean;

  constructor(isDescending: boolean) {
    this.isDescending = isDescending;
  }

  insert(price: Price, value: T): void {
    if (!this.tree.has(price)) {
      const idx = this.findInsertIndex(price);
      this.sortedPrices.splice(idx, 0, price);
    }
    this.tree.set(price, value);
  }

  delete(price: Price): boolean {
    const deleted = this.tree.delete(price);
    if (deleted) {
      const idx = this.sortedPrices.indexOf(price);
      if (idx >= 0) this.sortedPrices.splice(idx, 1);
    }
    return deleted;
  }

  get(price: Price): T | undefined {
    return this.tree.get(price);
  }

  has(price: Price): boolean {
    return this.tree.has(price);
  }

  *entries(): IterableIterator<[Price, T]> {
    for (const price of this.sortedPrices) {
      yield [price, this.tree.get(price)!];
    }
  }

  *keys(): IterableIterator<Price> {
    yield* this.sortedPrices;
  }

  *values(): IterableIterator<T> {
    for (const price of this.sortedPrices) {
      yield this.tree.get(price)!;
    }
  }

  get size(): number {
    return this.tree.size;
  }

  get bestPrice(): Price | undefined {
    return this.sortedPrices[0];
  }

  private findInsertIndex(price: Price): number {
    let low = 0, high = this.sortedPrices.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      const cmp = this.isDescending 
        ? this.sortedPrices[mid] - price 
        : price - this.sortedPrices[mid];
      if (cmp > 0) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  clear(): void {
    this.tree.clear();
    this.sortedPrices.length = 0;
  }
}
```

---

## 2. Domain Value Objects

```typescript
// src/domain/value-objects/side.ts
export enum Side {
  BUY = 'BUY',
  SELL = 'SELL'
}

export const oppositeSide = (side: Side): Side => 
  side === Side.BUY ? Side.SELL : Side.BUY;

export const isBuy = (side: Side): boolean => side === Side.BUY;
export const isSell = (side: Side): boolean => side === Side.SELL;
```

```typescript
// src/domain/value-objects/time-in-force.ts
export enum TimeInForce {
  GTC = 'GTC',  // Good Till Cancelled
  FOK = 'FOK',  // Fill Or Kill
  IOC = 'IOC'   // Immediate Or Cancel
}
```

```typescript
// src/domain/value-objects/order-type.ts
export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP_MARKET = 'STOP_MARKET',
  STOP_LIMIT = 'STOP_LIMIT',
  OCO = 'OCO'
}
```

```typescript
// src/domain/value-objects/operation-code.ts
export enum OperationCode {
  MATCH = 'm',
  LIMIT = 'l',
  STOP_MARKET = 'sm',
  STOP_LIMIT = 'sl',
  OCO = 'oco',
  CANCEL = 'c',
  UPDATE = 'u',
  UPDATE_PRICE = 'u_p',
  UPDATE_SIZE = 'u_s'
}
```

---

## 3. Domain Entities

```typescript
// src/domain/entities/limit-order.ts
import { OrderId, AccountId, Price, Quantity, Timestamp, Side, TimeInForce } from '../../shared/types/branded';

export interface LimitOrderProps {
  id: OrderId