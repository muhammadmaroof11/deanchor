```typescript
/**
 * Modern Order Book Implementation
 * 
 * A clean-slate, type-safe implementation of a limit order book with support for:
 * - Limit, Market, Stop-Limit, Stop-Market, and OCO orders
 * - Self-Trade Prevention (STP)
 * - Time-in-Force (GTC, IOC, FOK)
 * - Journaling and snapshot recovery
 * - Price-time priority matching
 */

// ============================================================================
// Core Types & Enums
// ============================================================================

export enum Side {
  BUY = "buy",
  SELL = "sell",
}

export enum OrderType {
  LIMIT = "limit",
  MARKET = "market",
  STOP_LIMIT = "stop_limit",
  STOP_MARKET = "stop_market",
  OCO = "oco",
}

export enum TimeInForce {
  GTC = "GTC",  // Good Till Cancelled
  IOC = "IOC",  // Immediate Or Cancel
  FOK = "FOK",  // Fill Or Kill
}

export enum SelfTradePreventionMode {
  NONE = "none",
  EXPIRE_MAKER = "expire_maker",
  EXPIRE_TAKER = "expire_taker",
  EXPIRE_BOTH = "expire_both",
}

export enum OrderStatus {
  NEW = "new",
  PARTIAL = "partial",
  FILLED = "filled",
  CANCELLED = "cancelled",
  REJECTED = "rejected",
  EXPIRED = "expired",
  TRIGGERED = "triggered",
}

// ============================================================================
// Error System
// ============================================================================

export class OrderBookError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "OrderBookError";
    this.code = code;
    this.details = details;
  }
}

export const ErrorCodes = {
  INVALID_ORDER_TYPE: "INVALID_ORDER_TYPE",
  INVALID_SIDE: "INVALID_SIDE",
  INVALID_QUANTITY: "INVALID_QUANTITY",
  INVALID_PRICE: "INVALID_PRICE",
  INVALID_STOP_PRICE: "INVALID_STOP_PRICE",
  INVALID_TIF: "INVALID_TIF",
  INSUFFICIENT_QUANTITY: "INSUFFICIENT_QUANTITY",
  ORDER_ALREADY_EXISTS: "ORDER_ALREADY_EXISTS",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  ORDER_NOT_CANCELLABLE: "ORDER_NOT_CANCELLABLE",
  STP_TRIGGERED: "STP_TRIGGERED",
  FOK_NOT_FILLED: "FOK_NOT_FILLED",
  POST_ONLY_WOULD_TRADE: "POST_ONLY_WOULD_TRADE",
  INVALID_JOURNAL_LOG: "INVALID_JOURNAL_LOG",
  INVALID_SNAPSHOT: "INVALID_SNAPSHOT",
  OCO_REQUIRES_STOP_PRICE: "OCO_REQUIRES_STOP_PRICE",
  OCO_REQUIRES_STOP_LIMIT_PRICE: "OCO_REQUIRES_STOP_LIMIT_PRICE",
} as const;

// ============================================================================
// Order Interfaces & Classes
// ============================================================================

export interface OrderBase {
  id: string;
  side: Side;
  type: OrderType;
  size: number;
  filledSize: number;
  status: OrderStatus;
  timestamp: number;
  accountId?: string;
  clientOrderId?: string;
  timeInForce: TimeInForce;
  postOnly: boolean;
}

export interface LimitOrderData extends OrderBase {
  type: OrderType.LIMIT;
  price: number;
}

export interface MarketOrderData extends OrderBase {
  type: OrderType.MARKET;
}

export interface StopLimitOrderData extends OrderBase {
  type: OrderType.STOP_LIMIT;
  price: number;
  stopPrice: number;
  stopLimitTimeInForce?: TimeInForce;
}

export interface StopMarketOrderData extends OrderBase {
  type: OrderType.STOP_MARKET;
  stopPrice: number;
}

export interface OCOOrderData extends OrderBase {
  type: OrderType.OCO;
  price: number;
  stopPrice: number;
  stopLimitPrice: number;
  stopLimitTimeInForce?: TimeInForce;
}

export type OrderData = 
  | LimitOrderData 
  | MarketOrderData 
  | StopLimitOrderData 
  | StopMarketOrderData 
  | OCOOrderData;

export interface OrderFill {
  orderId: string;
  price: number;
  size: number;
  timestamp: number;
  isMaker: boolean;
  counterOrderId: string;
  counterAccountId?: string;
}

export interface ProcessResult {
  fills: OrderFill[];
  activated: OrderData[];
  partial: OrderData | null;
  partialQuantityProcessed: number;
  quantityLeft: number;
  stpExpired?: OrderData[];
  error: OrderBookError | null;
  log?: JournalEntry;
}

// ============================================================================
// Journal & Snapshot Types
// ============================================================================

export interface JournalEntry {
  opId: number;
  timestamp: number;
  operation: JournalOperation;
  payload: unknown;
}

export type JournalOperation = 
  | "limit" 
  | "market" 
  | "stop_limit" 
  | "stop_market" 
  | "oco" 
  | "cancel" 
  | "modify_price" 
  | "modify_size";

export interface Snapshot {
  lastOpId: number;
  marketPrice: number;
  bids: PriceLevelSnapshot[];
  asks: PriceLevelSnapshot[];
  stopOrders: StopOrderSnapshot[];
  orders: Map<string, OrderData>;
}

export interface PriceLevelSnapshot {
  price: number;
  orders: OrderData[];
}

export interface StopOrderSnapshot {
  side: Side;
  stopPrice: number;
  orders: OrderData[];
}

// ============================================================================
// Configuration Options
// ============================================================================

export interface OrderBookConfig {
  enableJournaling?: boolean;
  snapshot?: Snapshot;
  journal?: JournalEntry[];
}

export interface CreateOrderOptions {
  type: OrderType;
  side: Side;
  size: number;
  price?: number;
  stopPrice?: number;
  stopLimitPrice?: number;
  id?: string;
  postOnly?: boolean;
  timeInForce?: TimeInForce;
  stopLimitTimeInForce?: TimeInForce;
  accountId?: string;
  clientOrderId?: string;
}

export interface CancelOrderOptions {
  orderId: string;
  isInternal?: boolean;
}

export interface ModifyOrderOptions {
  orderId: string;
  newPrice?: number;
  newSize?: number;
}

// ============================================================================
// Price Level / Order Queue
// ============================================================================

interface PriceLevel {
  price: number;
  orders: OrderData[];
  totalVolume: number;
}

class OrderQueue {
  private readonly orders: Map<string, OrderData> = new Map();
  private readonly orderIds: string[] = [];
  public readonly price: number;
  public readonly side: Side;

  constructor(price: number, side: Side) {
    this.price = price;
    this.side = side;
  }

  get length(): number {
    return this.orderIds.length;
  }

  get volume(): number {
    return this.orderIds.reduce((sum, id) => sum + (this.orders.get(id)?.size ?? 0), 0);
  }

  head(): OrderData | undefined {
    const id = this.orderIds[0];
    return id ? this.orders.get(id) : undefined;
  }

  add(order: OrderData): void {
    if (!this.orders.has(order.id)) {
      this.orders.set(order.id, order);
      this.orderIds.push(order.id);
    }
  }

  remove(orderId: string): OrderData | undefined {
    const order = this.orders.get(orderId);
    if (order) {
      this.orders.delete(orderId);
      const index = this.orderIds.indexOf(orderId);
      if (index !== -1) this.orderIds.splice(index, 1);
    }
    return order;
  }

  update(orderId: string, updatedOrder: OrderData): void {
    if (this.orders.has(orderId))