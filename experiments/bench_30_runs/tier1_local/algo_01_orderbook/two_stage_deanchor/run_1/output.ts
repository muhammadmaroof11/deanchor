# Production-Grade Greenfield Implementation for Order Book System

## Architecture Overview

This implementation follows a clean, modular architecture with clear separation of concerns. The system is designed around the core domain entities while maintaining extensibility and testability.

### Key Design Principles:
1. **Domain-Centric**: All business logic resides within domain models
2. **Immutable Data Structures**: Core state managed immutably for safety
3. **Functional Programming Patterns**: Pure functions where possible, with explicit side effects
4. **Event-Driven Architecture**: State transitions are driven by events
5. **Type Safety**: Strong typing throughout the system

## File Structure

```
src/
├── domain/
│   ├── entities/
│   │   ├── OrderBook.ts
│   │   ├── LimitOrder.ts
│   │   ├── StopLimitOrder.ts
│   │   ├── StopMarketOrder.ts
│   │   └── OrderSide.ts
│   ├── value-objects/
│   │   ├── Side.ts
│   │   ├── TimeInForce.ts
│   │   ├── OrderType.ts
│   │   └── SelfTradePreventionMode.ts
│   ├── repositories/
│   │   └── IOrderBookRepository.ts
│   └── events/
│       ├── OrderCreatedEvent.ts
│       ├── OrderCancelledEvent.ts
│       ├── OrderExecutedEvent.ts
│       ├── MarketPriceUpdatedEvent.ts
│       └── JournalEntryCreatedEvent.ts
├── application/
│   ├── services/
│   │   ├── OrderBookService.ts
│   │   └── OrderProcessingService.ts
│   ├── commands/
│   │   ├── CreateOrderCommand.ts
│   │   ├── MarketOrderCommand.ts
│   │   ├── LimitOrderCommand.ts
│   │   ├── StopMarketOrderCommand.ts
│   │   ├── StopLimitOrderCommand.ts
│   │   └── OCOOrderCommand.ts
│   └── dtos/
│       ├── CreateOrderOptions.ts
│       ├── MarketOrderOptions.ts
│       ├── LimitOrderOptions.ts
│       ├── StopMarketOrderOptions.ts
│       ├── StopLimitOrderOptions.ts
│       └── OCOOrderOptions.ts
├── infrastructure/
│   ├── persistence/
│   │   └── InMemoryOrderBookRepository.ts
│   └── logging/
│       └── JournalLogger.ts
└── shared/
    ├── types/
    │   ├── OrderQueue.ts
    │   └── IProcessOrder.ts
    └── utils/
        └── IdGenerator.ts
```

## Core Implementation

### 1. Domain Entities

#### `src/domain/entities/OrderBook.ts`
```typescript
import { LimitOrder } from './LimitOrder';
import { StopBook } from './StopBook';
import { OrderSide } from './OrderSide';
import { IProcessOrder } from '../../shared/types/IProcessOrder';

export class OrderBook {
  private _orders: Map<string, LimitOrder>;
  private _lastOp: number;
  private _marketPrice: number;
  private _bids: OrderSide;
  private _asks: OrderSide;
  private _enableJournaling: boolean;
  private _stopBook: StopBook;

  constructor() {
    this._orders = new Map();
    this._lastOp = 0;
    this._marketPrice = 0;
    this._bids = new OrderSide('bid');
    this._asks = new OrderSide('ask');
    this._enableJournaling = false;
    this._stopBook = new StopBook();
  }

  // Getters and setters
  get orders(): Map<string, LimitOrder> {
    return this._orders;
  }
  
  get lastOp(): number {
    return this._lastOp;
  }
  
  set lastOp(value: number) {
    this._lastOp = value;
  }
  
  get marketPrice(): number {
    return this._marketPrice;
  }
  
  set marketPrice(value: number) {
    this._marketPrice = value;
  }
  
  get bids(): OrderSide {
    return this._bids;
  }
  
  get asks(): OrderSide {
    return this._asks;
  }
  
  get enableJournaling(): boolean {
    return this._enableJournaling;
  }
  
  set enableJournaling(value: boolean) {
    this._enableJournaling = value;
  }
  
  get stopBook(): StopBook {
    return this._stopBook;
  }

  // Business methods
  addOrder(order: LimitOrder): void {
    this._orders.set(order.id, order);
  }

  removeOrder(orderId: string): boolean {
    return this._orders.delete(orderId);
  }
}
```

#### `src/domain/entities/LimitOrder.ts`
```typescript
import { Side } from '../value-objects/Side';
import { TimeInForce } from '../value-objects/TimeInForce';
import { OrderType } from '../value-objects/OrderType';

export class LimitOrder {
  id: string;
  side: Side;
  size: number;
  price: number;
  accountId: string;
  timeInForce: TimeInForce;
  postOnly: boolean;
  ocoStopPrice?: number;
  type: OrderType;

  constructor(
    id: string,
    side: Side,
    size: number,
    price: number,
    accountId: string,
    timeInForce: TimeInForce,
    postOnly: boolean = false,
    ocoStopPrice?: number
  ) {
    this.id = id;
    this.side = side;
    this.size = size;
    this.price = price;
    this.accountId = accountId;
    this.timeInForce = timeInForce;
    this.postOnly = postOnly;
    this.ocoStopPrice = ocoStopPrice;
    this.type = OrderType.LIMIT;
  }

  // Validation methods
  validate(): boolean {
    return (
      this.price > 0 &&
      this.size > 0 &&
      this.id !== undefined &&
      this.id.length > 0
    );
  }
}
```

#### `src/domain/entities/StopLimitOrder.ts`
```typescript
import { Side } from '../value-objects/Side';
import { TimeInForce } from '../value-objects/TimeInForce';
import { OrderType } from '../value-objects/OrderType';

export class StopLimitOrder {
  id: string;
  side: Side;
  size: number;
  price: number;
  stopPrice: number;
  stopLimitPrice: number;
  accountId: string;
  timeInForce: TimeInForce;
  stopLimitTimeInForce: TimeInForce;
  postOnly: boolean;
  ocoStopPrice?: number;
  type: OrderType;

  constructor(
    id: string,
    side: Side,
    size: number,
    price: number,
    stopPrice: number,
    stopLimitPrice: number,
    accountId: string,
    timeInForce: TimeInForce,
    stopLimitTimeInForce: TimeInForce,
    postOnly: boolean = false,
    ocoStopPrice?: number
  ) {
    this.id = id;
    this.side = side;
    this.size = size;
    this.price = price;
    this.stopPrice = stopPrice;
    this.stopLimitPrice = stopLimitPrice;
    this.accountId = accountId;
    this.timeInForce = timeInForce;
    this.stopLimitTimeInForce = stopLimitTimeInForce;
    this.postOnly = postOnly;
    this.ocoStopPrice = ocoStopPrice;
    this.type = OrderType.STOP_LIMIT;
  }

  // Validation methods
  validate(): boolean {
    return (
      this.price > 0 &&
      this.size > 0 &&
      this.stopPrice > 0 &&
      this.stopLimitPrice > 0 &&
      this.id !== undefined &&
      this.id.length > 0
    );
  }
}
```

#### `src/domain/entities/StopMarketOrder.ts`
```typescript
import { Side } from '../value-objects/Side';
import { OrderType } from '../value-objects/OrderType';

export class StopMarketOrder {
  id: string;
  side: Side;
  size: number;
  stopPrice: number;
  accountId: string;
  type: OrderType;

  constructor(
    id: string,
    side: Side,
    size: number,
    stopPrice: number,
    accountId: string
  ) {
    this.id = id;
    this.side = side;
    this.size = size;
    this.stopPrice = stopPrice;
    this.accountId = accountId;
    this.type = OrderType.STOP_MARKET;
  }

  // Validation methods
  validate(): boolean {
    return (
      this.stopPrice > 0 &&
      this.size > 0 &&
      this.id !== undefined &&
      this.id.length > 0
    );
  }
}
```

#### `src/domain/entities/OrderSide.ts`
```typescript
import { Side } from '../value-objects/Side';
import { OrderQueue } from '../../shared/types/OrderQueue';

export class OrderSide {
  side: Side;
  priceTree: Map<number, OrderQueue>;

  constructor(side: Side) {
    this.side = side;
    this.priceTree = new Map();
  }

  // Add order to the appropriate queue
  addOrder(orderId: string, price: number): void {
    if (!this.priceTree.has(price)) {
      this.priceTree.set(price, new OrderQueue(price));
    }
    
    const queue = this.priceTree.get(price)!;
    queue.addOrder(orderId);
  }

  // Remove order from the