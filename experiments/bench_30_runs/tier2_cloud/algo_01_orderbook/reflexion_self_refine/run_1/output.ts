# Architectural Critique

## Critical Failures in Draft

| Issue | Severity | Impact |
|-------|----------|--------|
| **No Aggregate Root Implementation** | 🔴 Critical | Core `OrderBook` business logic entirely missing |
| **No Matching Engine** | 🔴 Critical | Price-time priority, FOK/IOC, post-only, STP not implemented |
| **No Order Side / Price Level / Queue Structures** | 🔴 Critical | Order book data structures absent |
| **No Stop Book Logic** | 🔴 Critical | Stop-limit/stop-market triggering missing |
| **No OCO Implementation** | 🔴 Critical | One-Cancels-Other logic absent |
| **No Journaling/Snapshot/Restore** | 🔴 Critical | Persistence & recovery contract broken |
| **No Public API Surface** | 🔴 Critical | `createOrder`, `cancel`, `amend`, `getL2Snapshot` missing |
| **Incomplete Event Definitions** | 🟡 High | Missing `OrderCancelled`, `OrderAmended`, `StopTriggered`, `OCOTriggered` |
| **No Error Handling Strategy** | 🟡 High | `CustomError`/`ERROR` codes not mapped to domain exceptions |

## Preservation Checklist (Original → Modern)

| Original Feature | Status | Modern Equivalent |
|------------------|--------|-------------------|
| `OrderBook.createOrder()` | ❌ | `OrderBook.handle(PlaceOrderCommand)` |
| `market()` / `limit()` / `stopMarket()` / `stopLimit()` / `oco()` | ❌ | Command handlers in aggregate |
| `cancelOrder()` / `amendOrder()` | ❌ | Command handlers |
| `processStopOrders()` | ❌ | `StopOrderMonitor` domain service |
| `getL2Snapshot()` / `getL3Snapshot()` | ❌ | `L2DepthProjection` / `OrderBookReadModel` |
| `restoreSnapshot()` / `replayJournal()` | ❌ | `EventStore.loadAggregate()` |
| `enableJournaling` + `JournalLog` | ❌ | Event Sourcing (EventStore) |
| `SelfTradePreventionMode` | ❌ | `SelfTradePreventionService` |
| `TimeInForce` (GTC/FOK/IOC) | ❌ | `MatchingEngine` enforcement |
| `postOnly` | ❌ | `MatchingEngine` validation |
| `marketPrice` / `lastOp` tracking | ❌ | Derived from events / sequence |

---

# Greenfield Implementation

## Project Structure

```
src/
├── domain/
│   ├── primitives.ts           # Branded types, validation
│   ├── events.ts               # Domain events (source of truth)
│   ├── commands.ts             # Commands (intent)
│   ├── errors.ts               # Domain errors (no CustomError)
│   ├── value-objects/
│   │   ├── Order.ts            # Order entity + factory
│   │   ├── PriceLevel.ts       # Price level with queue
│   │   ├── OrderSide.ts        # Bid/Ask side logic
│   │   └── StopOrder.ts        # Stop order entity
│   ├── aggregates/
│   │   └── OrderBook.ts        # Aggregate root (Event Sourced)
│   ├── services/
│   │   ├── MatchingEngine.ts   # Pure matching logic
│   │   ├── SelfTradePrevention.ts
│   │   ├── StopOrderMonitor.ts
│   │   └── RiskEngine.ts
│   └── projections/
│       ├── L2DepthProjection.ts
│       └── TradeHistoryProjection.ts
├── infrastructure/
│   ├── event-store/
│   │   ├── EventStore.ts
│   │   ├── InMemoryEventStore.ts
│   │   └── PersistentEventStore.ts
│   └── snapshots/
│       └── SnapshotStore.ts
├── application/
│   ├── OrderBookService.ts     # Application service (orchestration)
│   └── dto/
│       ├── PlaceOrderDTO.ts
│       ├── CancelOrderDTO.ts
│       └── OrderBookSnapshotDTO.ts
└── interfaces/
    ├── rest/
    │   └── OrderBookController.ts
    └── ws/
        └── OrderBookWebSocketHandler.ts
```

---

## 1. Domain Primitives & Errors

```typescript
// src/domain/primitives.ts
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type OrderId = Brand<string, 'OrderId'>;
export type AccountId = Brand<string, 'AccountId'>;
export type Price = Brand<number, 'Price'>;
export type Quantity = Brand<number, 'Quantity'>;
export type Timestamp = Brand<number, 'Timestamp'>;
export type SequenceNumber = Brand<number, 'SequenceNumber'>;
export type TradeId = Brand<string, 'TradeId'>;
export type Symbol = Brand<string, 'Symbol'>;

export const Side = { BUY: 'BUY' as const, SELL: 'SELL' as const };
export type Side = typeof Side[keyof typeof Side];

export const OrderType = {
  LIMIT: 'LIMIT' as const,
  MARKET: 'MARKET' as const,
  STOP_LIMIT: 'STOP_LIMIT' as const,
  STOP_MARKET: 'STOP_MARKET' as const,
  OCO: 'OCO' as const,
};
export type OrderType = typeof OrderType[keyof typeof OrderType];

export const TimeInForce = {
  GTC: 'GTC' as const,
  FOK: 'FOK' as const,
  IOC: 'IOC' as const,
};
export type TimeInForce = typeof TimeInForce[keyof typeof TimeInForce];

export const SelfTradePreventionMode = {
  NONE: 'NONE' as const,
  EXPIRE_TAKER: 'EXPIRE_TAKER' as const,
  EXPIRE_MAKER: 'EXPIRE_MAKER' as const,
  EXPIRE_BOTH: 'EXPIRE_BOTH' as const,
};
export type SelfTradePreventionMode = typeof SelfTradePreventionMode[keyof typeof SelfTradePreventionMode];

export const OrderStatus = {
  NEW: 'NEW' as const,
  PARTIALLY_FILLED: 'PARTIALLY_FILLED' as const,
  FILLED: 'FILLED' as const,
  CANCELLED: 'CANCELLED' as const,
  REJECTED: 'REJECTED' as const,
  EXPIRED: 'EXPIRED' as const,
  PENDING_TRIGGER: 'PENDING_TRIGGER' as const,
};
export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

// Factories with validation
export const OrderId = {
  generate: (): OrderId => crypto.randomUUID() as OrderId,
  from: (v: string): OrderId => { if (!v) throw DomainError('EMPTY_ORDER_ID'); return v as OrderId; },
};

export const Price = {
  from: (v: number): Price => { if (!Number.isFinite(v) || v <= 0) throw DomainError('INVALID_PRICE'); return v as Price; },
  toNumber: (p: Price): number => p,
  compare: (a: Price, b: Price): number => a - b,
};

export const Quantity = {
  from: (v: number): Quantity => { if (!Number.isFinite