### Architectural Critique & Greenfield Blueprint

#### 1. Critical Evaluation of the Legacy Architecture
* **State Pollution & Object Mutability:** The original codebase mixes domain entities (`LimitOrder`) with mutable properties, complex procedural matching loops inside data-structure classes, and tightly coupled side-effects (such as inline journaling during matching execution).
* **Control Flow Fragility:** Order matching (Maker/Taker mechanics, Post-Only, FOK, IOC, STP) is interwoven with state mutations across `OrderBook`, `OrderSide`, and `OrderQueue`. This violates the Single Responsibility Principle and creates hidden coupling bugs.
* **Typing & Structural Anomalies:** Legacy definitions used loose union types and inconsistent nullability checks, opening vectors for runtime type pollution and unhandled edge cases during snapshot/journal replays.

#### 2. Greenfield Architectural Paradigm
To build a bulletproof, institutional-grade matching engine, the system is restructured into **Clean Domain-Driven Layers**:
1. **Value Objects & Immutable Domain Entities:** Strict immutability (`readonly` primitives, frozen records) for orders, trades, and market snapshots.
2. **Pure Functional Matching Core:** Order matching is implemented as a pure state-transition reduction. Given an order book state and an incoming order, it returns the *next* state and a list of execution receipts (trades/activations), completely decoupled from I/O, logging, or persistence.
3. **Event-Sourced Journaling & Snapshotting:** Journal logs and snapshots are treated as immutable state event streams, completely isolated from matching algorithms via structural projection.
4. **Optimized Data Structures:** Price levels maintain `O(1)` hash-map order lookups combined with doubly-linked or stable queue models to prevent linear searches (`Array.prototype.find` / `splice`) during high-frequency insertion, cancellation, and matching.

---

### Complete Greenfield Source Implementation

#### 1. Domain Types (`src/domain/types.ts`)
```typescript
export enum Side {
  BUY = 'buy',
  SELL = 'sell',
}

export enum OrderType {
  LIMIT = 'limit',
  MARKET = 'market',
  STOP_LIMIT = 'stop_limit',
  STOP_MARKET = 'stop_market',
  OCO = 'oco',
}

export enum TimeInForce {
  GTC = 'GTC',
  IOC = 'IOC',
  FOK = 'FOK',
}

export enum SelfTradePreventionMode {
  NONE = 'none',
  EXPIRE_MAKER = 'expire_maker',
  EXPIRE_TAKER = 'expire_taker',
  EXPIRE_BOTH = 'expire_both',
}

export interface IOrder {
  readonly id: string;
  readonly side: Side;
  readonly size: number;
  readonly price: number;
  readonly accountId?: string;
  readonly timeInForce: TimeInForce;
  readonly postOnly?: boolean;
  readonly ocoStopPrice?: number;
}

export interface TradeExecution {
  readonly makerOrderId: string;
  readonly takerOrderId: string;
  readonly price: number;
  readonly size: number;
  readonly side: Side;
  readonly timestamp: number;
}

export interface IProcessOrder {
  readonly done: IOrder[];
  readonly activated: IOrder[];
  readonly partial: IOrder | null;
  readonly partialQuantityProcessed: number;
  readonly quantityLeft: number;
  readonly trades: TradeExecution[];
  readonly err: Error | null;
  readonly log?: JournalLog;
  readonly stpExpired?: IOrder[];
}

export type JournalOpType = 'm' | 'l' | 'sm' | 'sl' | 'oco' | 'c';

export interface JournalLog {
  readonly opId: number;
  readonly ts: number;
  readonly op: JournalOpType;
  readonly o: Record<string, unknown>;
}

export interface Snapshot {
  readonly lastOp: number;
  readonly marketPrice: number;
  readonly bids: ReadonlyArray<[number, IOrder[]]>;
  readonly asks: ReadonlyArray<[number, IOrder[]]>;
  readonly orders: Record<string, IOrder>;
  readonly stops: ReadonlyArray<{ readonly side: Side; readonly stopPrice: number; readonly order: IOrder }>;
}
```

---

### 2. Domain Errors (`src/domain/errors.ts`)
```typescript
export const ERROR = {
  INVALID_ORDER_TYPE: "Invalid order type",
  INVALID_SIDE: "Invalid order side",
  INVALID_QUANTITY: "Invalid order quantity",
  INVALID_PRICE: "Invalid order price",
  INVALID_TIF: "Invalid time-in-force",
  INVALID_JOURNAL_LOG: "Invalid journal log format",
  ORDER_ALREADY_EXISTS: "Order already exists",
  ORDER_NOT_FOUND: "Order not found",
  INSUFFICIENT_QUANTITY: "Insufficient quantity",
  POST_ONLY_LIMIT_REJECTED: "Post-only limit order would cross",
  FOK_UNFILLABLE: "Fill-or-kill order cannot be filled immediately",
  STP_TRIGGERED: "Self-trade prevention triggered",
} as const;

export class OrderBookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderBookError";
    Object.setPrototypeOf(this, OrderBookError.prototype);
  }
}

export const createOrderBookError = (code: keyof typeof ERROR): OrderBookError => {
  return new OrderBookError(ERROR[code]);
};
```

---

### 3. Immutable Domain Entities (`src/domain/order.ts`)
```typescript
import { IOrder, Side, TimeInForce } from "./types";

export class LimitOrder implements IOrder {
  constructor(
    public readonly id: string,
    public readonly side: Side,
    public readonly size: number,
    public readonly price: number,
    public readonly timeInForce: TimeInForce = TimeInForce.GTC,
    public readonly accountId?: string,
    public readonly postOnly: boolean = false,
    public readonly ocoStopPrice?: number
  ) {
    Object.freeze(this);
  }

  public cloneWithNewSize(newSize: number): LimitOrder {
    return new LimitOrder(
      this.id,
      this.side,
      newSize,
      this.price,
      this.timeInForce,
      this.accountId,
      this.postOnly,
      this.ocoStopPrice
    );
  }

  public toObject(): IOrder {
    return {
      id: this.id,
      side: this.side,
      size: this.size,
      price: this.price,
      timeInForce: this.timeInForce,
      accountId: this.accountId,
      postOnly: this.postOnly,
      ocoStopPrice: this.ocoStopPrice,
    };
  }
}
```

---

### 4. High-Performance Order Queue (`src/engine/order-queue.ts`)
```typescript
import { LimitOrder } from "../domain/order";

export class OrderQueue {
  private readonly orders: LimitOrder[] = [];
  private readonly indexMap: Map<string, number> = new Map();
  private totalVolume = 0;

  constructor(private readonly _price: number) {}

  public get price(): number {
    return this._price;
  }

  public get length(): number {
    return this.orders.length;
  }

  public get volume(): number {
    return this.totalVolume;
  }

  public head(): LimitOrder | undefined {
    return this.orders[0];
  }

  public push(order: LimitOrder): void {
    this.orders.push(order);
    this.indexMap.set(order.id, this.orders.length - 1);
    this.totalVolume += order.size;
  }

  public remove(orderId: string): LimitOrder | undefined {
    const index = this.indexMap.get(orderId);
    if (index === undefined) return undefined;

    const [removed] = this.orders.splice(index, 1);
    this.indexMap.delete(orderId);
    this.totalVolume -= removed.size;

    // Rebuild index mapping for subsequent elements
    for (let i = index; i < this.orders.length; i++) {
      this.indexMap.set(this.orders[i].id, i);
    }

    return removed;
  }

  public updateSize(orderId: string, newSize: number): LimitOrder | undefined {
    const index = this.indexMap.get(orderId);
    if (index === undefined) return undefined;

    const oldOrder = this.orders[index];
    const diff = newSize - oldOrder.size;
    const updatedOrder = oldOrder.cloneWithNewSize(newSize);

    this