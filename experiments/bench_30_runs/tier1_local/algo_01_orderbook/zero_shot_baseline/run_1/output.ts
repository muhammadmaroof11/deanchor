# Modernized OrderBook Implementation

I'll completely refactor this order book implementation with a modern, clean architecture while preserving all functionality. Here's the redesigned solution:

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

const VALID_TIME_IN_FORCE = Object.values(TimeInForce);

/**
 * Core order book implementation with modern architecture
 */
export class OrderBook {
  private readonly orders: Map<string, LimitOrder> = new Map();
  private lastOp: number = 0;
  private marketPrice: number = 0;
  
  private readonly bids: OrderSide;
  private readonly asks: OrderSide;
  private readonly enableJournaling: boolean;
  private readonly stopBook: StopBook;

  /**
   * Creates an instance of OrderBook.
   * @param options - Configuration options for the order book
   */
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
      if (options.snapshot?.lastOp && options.snapshot.lastOp > 0) {
        filteredJournal = options.journal.filter(log => log.opId > options.snapshot!.lastOp!);
      }
      
      this.replayJournal(filteredJournal);
    }
  }

  /**
   * Gets the current market price
   */
  get marketPrice(): number {
    return this.marketPrice;
  }

  /**
   * Gets the last operation ID
   */
  get lastOp(): number {
    return this.lastOp;
  }

  /**
   * Creates a new order based on type
   */
  public createOrder(options: CreateOrderOptions): IProcessOrder {
    switch (options.type) {
      case OrderType.MARKET:
        return this.market(options);
      case OrderType.LIMIT:
        return this.limit(options);
      case OrderType.STOP_MARKET:
        return this.stopMarket(options);
      case OrderType.STOP_LIMIT:
        return this.stopLimit(options);
      case OrderType.OCO:
        return this.oco(options);
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
   * Creates a market order
   */
  public market(options: MarketOrderOptions): IProcessOrder {
    const response = this._market(options);
    
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
   * Creates a stop market order
   */
  public stopMarket(options: StopMarketOrderOptions): IProcessOrder {
    const response = this._stopMarket(options);
    
    if (this.enableJournaling && response.err === null) {
      response.log = {
        opId: ++this.lastOp,
        ts: Date.now(),
        op: "sm",
        o: options,
      };
    }
    
    return response;
  }

  /**
   * Creates a limit order
   */
  public limit(options: LimitOrderOptions): IProcessOrder {
    const response = this._limit(options);
    
    if (this.enableJournaling && response.err === null) {
      response.log = {
        opId: ++this.lastOp,
        ts: Date.now(),
        op: "l",
        o: options,
      };
    }
    
    return response;
  }

  /**
   * Creates a stop limit order
   */
  public stopLimit(options: StopLimitOrderOptions): IProcessOrder {
    const response = this._stopLimit(options);
    
    if (this.enableJournaling && response.err === null) {
      response.log = {
        opId: ++this.lastOp,
        ts: Date.now(),
        op: "sl",
        o: options,
      };
    }
    
    return response;
  }

  /**
   * Creates an OCO order
   */
  public oco(options: OCOOrderOptions): IProcessOrder {
    const response = this._oco(options);
    
    if (this.enableJournaling && response.err === null) {
      response.log = {
        opId: ++this.lastOp,
        ts: Date.now(),
        op: "o",
        o: options,
      };
    }
    
    return response;
  }

  /**
   * Cancels an order by ID
   */
  public cancelOrder(orderId: string): ICancelOrder | null {
    const result = this._cancelOrder(orderId, false);
    if (this.enableJournaling && result !== null) {
      // Add journal entry for cancellation
      const logEntry: JournalLog = {
        opId: ++this.lastOp,
        ts: Date.now(),
        op: "c",
        o: { orderId },
      };
      
      if (!result.log) {
        result.log = [];
      }
      result.log.push(logEntry);
    }
    
    return result;
  }

  /**
   * Cancels all orders for a specific account
   */
  public cancelAllOrders(accountId?: string): ICancelOrder[] {
    const cancelled: ICancelOrder[] = [];
    
    // Cancel all orders in the book
    this.orders.forEach(order => {
      if (accountId === undefined || order.accountId === accountId) {
        const result = this._cancelOrder(order.id, false);
        if (result !== null) {
          cancelled.push(result);
        }
      }
    });
    
    return cancelled;
  }

  /**
   * Gets a snapshot of the current state
   */
  public getSnapshot(): Snapshot {
    return {
      bids: this.bids.toPriceLevelArray(),
      asks: this.asks.toPriceLevelArray(),
      lastOp: this.lastOp,
      marketPrice: this.marketPrice,
    };
  }

  /**
   * Restores order book from a snapshot
   */
  private restoreSnapshot(snapshot: Snapshot): void {
    // Clear existing orders
    this.orders.clear();
    
    // Restore bids and asks
    if (snapshot.bids) {
      for (const priceLevel of snapshot.bids) {
        for (const order of priceLevel.orders) {
          const limitOrder = OrderFactory.createOrder(order);
          this.orders.set(limitOrder.id, limitOrder);
          this.bids.addOrder(limitOrder);
        }
      }
    }
    
    if (snapshot.asks) {
      for (const priceLevel of snapshot.asks) {
        for (const order of priceLevel.orders) {
          const limitOrder = OrderFactory.createOrder(order);
          this.orders.set(limitOrder.id, limitOrder);
          this.asks.addOrder(limitOrder);
        }
      }
    }
    
    // Set last operation and market price
    this.lastOp = snapshot.lastOp ?? 0;
    this.marketPrice = snapshot.marketPrice ?? 0;
  }

  /**
   * Replays journal logs to reconstruct state
   */
  private replayJournal(journal: JournalLog[]): void {
    for (const log of journal) {
      switch (log.op) {
        case "l":
          // Limit order
          this._limit(log.o as LimitOrderOptions);
          break;
        case "m":
          // Market order
          this._market(log.o as MarketOrderOptions);
          break;
        case "sm":
          // Stop market order
          this._stopMarket(log.o as StopMarketOrderOptions);
          break;
        case "sl":
          // Stop limit order
          this._stopLimit(log.o as StopLimitOrderOptions);
          break;
        case "o":
          // OCO order
          this._oco(log.o as OCOOrderOptions);
          break;
        case "c":
          // Cancel order
          if (log.o && typeof log.o === 'object' && 'orderId' in log.o) {
            this._cancelOrder(log.o.orderId, false);
          }
          break;
      }
    }
  }

  /**
   * Internal market order processing
   */
  private _market(options: MarketOrderOptions): IProcessOrder {
    const response = this.validateMarketOrder(options);
    
    if (response.err !== null) {
      return response;
    }
    
    // Determine which side to match against
    const matchingSide =