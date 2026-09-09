```typescript
/**
 * Modernized Order Book Implementation
 * 
 * Architecture: Domain-Driven Design with Event Sourcing
 * - Pure domain model with clear invariants
 * - Command-Query Separation
 * - Functional core (matching engine) with imperative shell
 * - Branded types for domain primitives
 * - Discriminated unions for commands/events/errors
 */

// ============================================================================
// DOMAIN PRIMITIVES (Branded Types)
// ============================================================================

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

type OrderId = Brand<string, 'OrderId'>;
type AccountId = Brand<string, 'AccountId'>;
type Price = Brand<number, 'Price'>;
type Quantity = Brand<number, 'Quantity'>;
type SequenceNumber = Brand<number, 'SequenceNumber'>;
type Timestamp = Brand<number, 'Timestamp'>;

const OrderId = (v: string): OrderId => v as OrderId;
const AccountId = (v: string): AccountId => v as AccountId;
const Price = (v: number): Price => {
  if (!Number.isFinite(v) || v <= 0) throw new DomainError('INVALID_PRICE', 'Price must be positive finite number');
  return v as Price;
};
const Quantity = (v: number): Quantity => {
  if (!Number.isFinite(v) || v <= 0) throw new DomainError('INVALID_QUANTITY', 'Quantity must be positive finite number');
  return v as Quantity;
};
const SequenceNumber = (v: number): SequenceNumber => v as SequenceNumber;
const Timestamp = (v: number): Timestamp => v as Timestamp;

// ============================================================================
// DOMAIN ENUMS & CONSTANTS
// ============================================================================

enum Side { BUY = 'BUY', SELL = 'SELL' }
enum OrderType { LIMIT = 'LIMIT', MARKET = 'MARKET', STOP_LIMIT = 'STOP_LIMIT', STOP_MARKET = 'STOP_MARKET', OCO = 'OCO' }
enum TimeInForce { GTC = 'GTC', IOC = 'IOC', FOK = 'FOK' }
enum SelfTradePrevention { NONE = 'NONE', EXPIRE_MAKER = 'EXPIRE_MAKER', EXPIRE_TAKER = 'EXPIRE_TAKER', EXPIRE_BOTH = 'EXPIRE_BOTH' }
enum OrderStatus { NEW = 'NEW', PARTIALLY_FILLED = 'PARTIALLY_FILLED', FILLED = 'FILLED', CANCELLED = 'CANCELLED', REJECTED = 'REJECTED', PENDING_TRIGGER = 'PENDING_TRIGGER' }

// ============================================================================
// ERROR HANDLING
// ============================================================================

class DomainError extends Error {
  constructor(public readonly code: string, message: string, public readonly metadata?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
  }
}

type Result<T, E = DomainError> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

const Ok = <T>(value: T): Result<T> => ({ ok: true, value });
const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// ============================================================================
// VALUE OBJECTS
// ============================================================================

interface OrderIdentity {
  orderId: OrderId;
  accountId: AccountId;
  clientOrderId?: string;
}

interface LimitOrderParams {
  side: Side;
  price: Price;
  quantity: Quantity;
  timeInForce: TimeInForce;
  postOnly: boolean;
  selfTradePrevention: SelfTradePre