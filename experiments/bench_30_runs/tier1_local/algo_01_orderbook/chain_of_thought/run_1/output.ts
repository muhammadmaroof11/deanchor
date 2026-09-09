# Modernized OrderBook Architecture

I'll completely refactor this order book implementation with a modern, clean architecture that preserves all business invariants while improving maintainability, performance, and scalability.

## Key Improvements:
1. **Clean Separation of Concerns**: Clear boundaries between domain logic, data structures, and infrastructure concerns
2. **Immutable Data Patterns**: Reduce side effects through immutable operations where appropriate
3. **Type Safety**: Enhanced TypeScript typing with better interfaces and constraints
4. **Performance Optimizations**: Efficient data structures for order matching and book management
5. **Modular Design**: Clear separation of core components (orders, sides, stop orders)
6. **Error Handling**: Consistent error handling patterns throughout

## Implementation:

```typescript
/* node:coverage ignore next - Don't know why first and last line of each file count as uncovered */
import { CustomError, ERROR } from "./errors";
import {
  type LimitOrder,
  OrderFactory,
  type StopLimitOrder,
  type StopMarketOrder,
} from "./order";
import type { OrderQueue } from "./orderqueue";
import { OrderSide } from "./orderside";
import { StopBook } from "./stopbook";
import {
  type CreateOrderOptions,
  type ICancelOrder,
  type ILimitOrder,
  type IOrder,
  type IProcessOrder,
  type JournalLog,
  type LimitOrderOptions,
  type MarketOrderOptions,
  type OCOOrderOptions,
  type OrderBookOptions,
  OrderType,
  type OrderUpdatePrice,
  type OrderUpdateSize,
  SelfTradePreventionMode,
  Side,
  type Snapshot,
  type StopLimitOrderOptions,
  type StopMarketOrderOptions,
  type StopOrder,
  TimeInForce,
} from "./types";

const validTimeInForce = Object.values(TimeInForce);

/**
 * Core domain entity representing a single order in the book
 */
export class OrderEntity {
  public readonly id: string;
  public readonly side: Side;
  public readonly size: number;
  public readonly price?: number;
  public readonly accountId?: string;
  public readonly type: OrderType;
  public readonly timeInForce?: TimeInForce;
  public readonly stopPrice?: number;
  public readonly stopLimitPrice?: number;
  public readonly ocoStopPrice?: number;

  constructor(options: {
    id: string;
    side: Side;
    size: number;
    price?: number;
    accountId?: string;
    type: OrderType;
    timeInForce?: TimeInForce;
    stopPrice?: number;
    stopLimitPrice?: number;
    ocoStopPrice?: number;
  }) {
    this.id = options.id;
    this.side = options.side;
    this.size = options.size;
    this.price = options.price;
    this.accountId = options.accountId;
    this.type = options.type;
    this.timeInForce = options.timeInForce;
    this.stopPrice = options.stopPrice;
    this.stopLimitPrice = options.stopLimitPrice;
    this.ocoStopPrice = options.ocoStopPrice;
  }

  /**
   * Creates a new order entity with updated size
   */
  public updateSize(newSize: number): OrderEntity {
    return new OrderEntity({
      ...this,
      size: newSize,
    });
  }

  /**
   * Converts to plain object representation
   */
  public toObject(): IOrder {
    return {
      id: this.id,
      side: this.side,
      size: this.size,
      price: this.price,
      accountId: this.accountId,
      type: this.type,
      timeInForce: this.timeInForce,
      stopPrice: this.stopPrice,
      stopLimitPrice: this.stopLimitPrice,
      ocoStopPrice: this.ocoStopPrice,
    };
  }
}

/**
 * Core order book domain service
 */
export class OrderBookService {
  private readonly orders = new Map<string, LimitOrder>();
  private lastOp = 0;
  private marketPrice = 0;
  private readonly bids: OrderSide;
  private readonly asks: OrderSide;
  private readonly enableJournaling: boolean;
  private readonly stopBook: StopBook;

  constructor(options: OrderBookOptions = {}) {
    this.bids = new OrderSide(Side.BUY);
    this.asks = new OrderSide(Side.SELL);
    this.enableJournaling = options.enableJournaling ?? false;
    this.stopBook = new StopBook();
    
    // Restore from snapshot if provided
    if (options.snapshot != null) {
      this.restoreSnapshot(options.snapshot);
    }
    
    // Replay journal logs if available
    if (options.journal != null) {
      if (!Array.isArray(options.journal)) {
        throw CustomError(ERROR.INVALID_JOURNAL_LOG);
      }
      
      let filteredJournal = options.journal;
      if (options.snapshot != null && options.snapshot.lastOp > 0) {
        filteredJournal = options.journal.filter((log) => log.opId > options.snapshot!.lastOp);
      }
      
      this.replayJournal(filteredJournal);
    }
  }

  /**
   * Gets the current market price
   */
  public getMarketPrice(): number {
    return this.marketPrice;
  }

  /**
   * Gets the last operation ID
   */
  public getLastOperationId(): number {
    return this.lastOp;
  }

  /**
   * Creates a new order based on options
   */
  public createOrder(options: CreateOrderOptions): IProcessOrder {
    switch (options.type) {
      case OrderType.MARKET:
        return this.processMarketOrder(options);
      case OrderType.LIMIT:
        return this.processLimitOrder(options);
      case OrderType.STOP_MARKET:
        return this.processStopMarketOrder(options);
      case OrderType.STOP_LIMIT:
        return this.processStopLimitOrder(options);
      case OrderType.OCO:
        return this.processOCOOrder(options);
      default:
        return {
          done: [],
          activated: [],
          partial: null,
          partialQuantityProcessed: 0,
          quantityLeft: 0,
          err: CustomError(ERROR.INVALID_ORDER_TYPE),
        };
    }
  }

  /**
   * Processes a market order
   */
  private processMarketOrder(options: MarketOrderOptions): IProcessOrder {
    const response = this.executeMarketOrder(options);
    
    if (this.enableJournaling && response.err === null) {
      response.log = {
        opId: ++this.lastOp,
        ts: Date.now(),
        op: "m",
        o: options,
      };
    }
    
    return response;
  }

  /**
   * Processes a limit order
   */
  private processLimitOrder(options: LimitOrderOptions): IProcessOrder {
    const validation = this.validateLimitOrder(options);
    if (validation.err !== null) {
      return validation;
    }

    // Create the new order
    const newOrder = OrderFactory.createOrder({
      ...options,
      id: options.id ?? `limit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }) as LimitOrder;

    // Add to book and process matching
    this.orders.set(newOrder.id, newOrder);
    
    const response = {
      done: [] as IOrder[],
      activated: [] as IOrder[],
      partial: null,
      partialQuantityProcessed: 0,
      quantityLeft: options.size,
      err: null as OrderBookError | null,
    };

    // Match against existing orders
    if (newOrder.side === Side.BUY) {
      const matchResult = this.matchAgainstAsks(newOrder, response);
      return { ...response, ...matchResult };
    } else {
      const matchResult = this.matchAgainstBids(newOrder, response);
      return { ...response, ...matchResult };
    }
  }

  /**
   * Processes a stop market order
   */
  private processStopMarketOrder(options: StopMarketOrderOptions): IProcessOrder {
    // Validate the order first
    const validation = this.validateMarketOrder(options);
    if (validation.err !== null) {
      return validation;
    }

    // Create and store the stop order
    const newOrder = OrderFactory.createOrder({
      ...options,
      id: options.id ?? `stop-market-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }) as StopMarketOrder;

    this.stopBook.add(newOrder.side, newOrder);
    
    // If stop price is met immediately, execute it
    if (this.shouldExecuteStopOrder(newOrder)) {
      return this.executeStopMarketOrder(newOrder);
    }

    return {
      done: [],
      activated: [newOrder.toObject()],
      partial: null,
      partialQuantityProcessed: 0,
      quantityLeft: options.size,
      err: null,
    };
  }

  /**
   * Processes a stop limit order
   */
  private processStopLimitOrder(options: StopLimitOrderOptions): IProcessOrder {
    // Validate the order first
    const validation = this.validateLimitOrder(options);
    if (validation.err !== null) {
      return validation;
    }

    // Create and store the stop order
    const newOrder = OrderFactory.createOrder({
      ...options,
      id: options.id ?? `stop-limit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }) as StopLimitOrder;

    this.stopBook.add(newOrder.side, newOrder);
    
    // If stop price is met immediately, execute it
    if (this.shouldExecuteStopOrder(newOrder)) {
      return this.executeStopLimitOrder(newOrder);
    }

    return {
      done: [],
      activated: [newOrder.toObject()],
      partial: null,
      partialQuantityProcessed: 0,
      quantityLeft: options.size,
