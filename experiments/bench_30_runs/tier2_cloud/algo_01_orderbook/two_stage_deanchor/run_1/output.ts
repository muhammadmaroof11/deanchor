Here is a production-grade, state-of-the-art greenfield implementation of the matching engine domain schema, written in TypeScript. 

The architecture is fully decoupled, leveraging clean domain-driven design (DDD) principles, immutability where applicable, high-performance data structures (such as RB-Tree simulations for price levels), and strict adherence to the business invariants and state transitions specified in your schema.

### Project Structure

```
matching-engine/
├── package.json
├── tsconfig.json
└── src/
    ├── domain/
    │   ├── enums.ts
    │   ├── models.ts
    │   └── errors.ts
    ├── structures/
    │   ├── PriceTree.ts
    │   └── StopBook.ts
    ├── engine/
    │   ├── OrderBook.ts
    │   └── MatchingEngine.ts
    └── index.ts
```

---

### 1. Configuration & Dependencies (`package.json`)

```json
{
  "name": "matching-engine",
  "version": "1.0.0",
  "description": "High-performance matching engine domain model",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "bintrees": "^1.0.2"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 2. TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

---

### 3. Domain Layer (`src/domain/`)

#### Enums (`src/domain/enums.ts`)
```typescript
export enum Side {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum TimeInForce {
  GTC = 'GTC', // Good 'Til Cancelled
  IOC = 'IOC', // Immediate or Cancel
  FOK = 'FOK', // Fill or Kill
}

export enum SelfTradePreventionMode {
  EXPIRE_MAKER = 'EXPIRE_MAKER',
  EXPIRE_TAKER = 'EXPIRE_TAKER',
  EXPIRE_BOTH = 'EXPIRE_BOTH',
}

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP_MARKET = 'STOP_MARKET',
  STOP_LIMIT = 'STOP_LIMIT',
  OCO = 'OCO',
}

export enum OrderState {
  UNINITIALIZED = 'Uninitialized',
  SNAPSHOT_RESTORED = 'SnapshotRestored',
  JOURNAL_REPLAYED = 'JournalReplayed',
  ACTIVE = 'Active',
  PARTIALLY_FILLED = 'PartiallyFilled',
  FILLED = 'Filled',
  CANCELED = 'Canceled',
}

export enum DomainErrorCode {
  INVALID_ORDER_TYPE = 'INVALID_ORDER_TYPE',
  INVALID_SIDE = 'INVALID_SIDE',
  INVALID_SIZE = 'INVALID_SIZE',
  INVALID_PRICE = 'INVALID_PRICE',
  DUPLICATE_ORDER_ID = 'DUPLICATE_ORDER_ID',
  INVALID_TIME_IN_FORCE = 'INVALID_TIME_IN_FORCE',
  STP_TERMINATION = 'STP_TERMINATION',
  FILL_OR_KILL_FAILED = 'FILL_OR_KILL_FAILED',
}
```

#### Models (`src/domain/models.ts`)
```typescript
import { Side, TimeInForce, SelfTradePreventionMode, OrderType, OrderState, DomainErrorCode } from './enums.js';

export interface IOrder {
  id: string;
  side: Side;
  size: number;
  price: number;
  accountId: string;
  timeInForce: TimeInForce;
  ocoStopPrice?: number;
  state: OrderState;
  type: OrderType;
}

export interface LimitOrderOptions {
  id: string;
  side: Side;
  size: number;
  price: number;
  accountId: string;
  timeInForce: TimeInForce;
  ocoStopPrice?: number;
  type?: OrderType;
}

export interface MarketOrderOptions {
  id: string;
  side: Side;
  size: number;
  accountId: string;
  timeInForce?: TimeInForce;
  stpMode?: SelfTradePreventionMode;
}

export interface StopMarketOrderOptions extends MarketOrderOptions {
  stopPrice: number;
}

export interface StopLimitOrderOptions extends LimitOrderOptions {
  stopPrice: number;
}

export type CreateOrderOptions = 
  | (LimitOrderOptions & { type: OrderType.LIMIT })
  | (MarketOrderOptions & { type: OrderType.MARKET })
  | (StopMarketOrderOptions & { type: OrderType.STOP_MARKET })
  | (StopLimitOrderOptions & { type: OrderType.STOP_LIMIT })
  | (LimitOrderOptions & { type: OrderType.OCO });

export interface OrderQueue {
  price: number;
  volume: number;
  length: number;
  orders: IOrder[];
}

export interface JournalLog {
  timestamp: number;
  lastOp: number;
  operation: string;
  payload: unknown;
}

export interface OrderBookError {
  code: DomainErrorCode;
  message: string;
}

export interface IProcessOrder {
  done: IOrder[];
  activated: IOrder[];
  partial?: IOrder;
  partialQuantityProcessed: number;
  quantityLeft: number;
  stpExpired: IOrder[];
  err?: OrderBookError;
  log?: JournalLog;
}
```

---

### 4. Data Structures (`src/structures/`)

#### PriceTree (`src/structures/PriceTree.ts`)
```typescript
import { CBTree } from 'bintrees';
import { OrderQueue, IOrder } from '../domain/models.js';
import { Side } from '../domain/enums.js';

export class OrderSide {
  public side: Side;
  public volume: number = 0;
  public priceTree: CBTree<number, OrderQueue>;

  constructor(side: Side) {
    this.side = side;
    // Bids sorted descending (highest price first), Asks sorted ascending (lowest price first)
    const comparator = side === Side.BUY 
      ? (a: number, b: number) => b - a 
      : (a: number, b: number) => a - b;
    this.priceTree = new CBTree<number, OrderQueue>(comparator);
  }

  public addOrder(order: IOrder): void {
    let queue = this.priceTree.find(order.price);
    if (!queue) {
      queue = { price: order.price, volume: 0, length: 0, orders: [] };
      this.priceTree.insert(order.price, queue);
    }
    queue.orders.push(order);
    queue.volume += order.size;
    queue.length += 1;
    this.volume += order.size;
  }

  public removeOrder(order: IOrder): boolean {
    const queue = this.priceTree.find(order.price);
    if (!queue) return false;

    const index = queue.orders.findIndex(o => o.id === order.id);
    if (index === -1) return false;

    queue.orders.splice(index, 1);
    queue.volume -= order.size;
    queue.length -= 1;
    this.volume -= order.size;

    if (queue.length === 0) {
      this.priceTree.remove(order.price);
    }
    return true;
  }

  public peekBestQueue(): OrderQueue | null {
    const node = this.priceTree.min();
    return node ? this.priceTree.find(node) : null;
  }
}
```

#### StopBook (`src/structures/StopBook.ts`)
```typescript
import { IOrder } from '../domain/models.js';

export class StopBook {
  private stops: Map<string, IOrder> = new Map();

  public add(order: IOrder): void {
    this.stops.set(order.id, order);
  }