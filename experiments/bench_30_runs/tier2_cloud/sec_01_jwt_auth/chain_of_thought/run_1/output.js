### Architectural Analysis & Domain Invariants

#### 1. Fundamental Domain Invariants
*   **Identity Uniqueness**: `username` and `email` must be globally unique.
*   **Credential Integrity**: Passwords **never** stored in plaintext; must use memory-hard KDF (Argon2id).
*   **Authorization Baseline**: Every `User` *must* possess at least one `Role` (Default: `ROLE_USER`).
*   **Token Integrity**: JWTs must be signed with strong keys (HS256 min 256-bit entropy or RS256), short expiry, and strict validation (aud/iss).
*   **Atomicity**: User creation + Role assignment is a single atomic transaction.

#### 2. Critical Flaws in Source Implementation
| Category | Flaw | Risk |
| :--- | :--- | :--- |
| **Security** | `bcryptjs` (CPU-hard only), `allowInsecureKeySizes: true`, 24h token expiry, hardcoded Role ID `1` | Brute-force feasible, Key confusion attacks, Long credential theft window, DB coupling |
| **Architecture** | Anemic Controller, ORM leakage (`db.Sequelize.Op`), Callback/Promise Hell, No Validation Layer | Untestable, Unmaintainable, SQL Injection surface (via `Op.or` misuse), Tight Coupling |
| **Resilience** | No Transaction boundary, Generic `500` errors leaking stack traces, No Idempotency | Partial writes (User w/o Role), Info Leakage, Duplicate submissions |
| **Modernity** | CommonJS, `var`, No Type Safety, Manual Dependency Resolution | Developer Experience, Runtime Errors, Supply Chain Risk |

---

### Modernized Greenfield Architecture

**Stack**: Node 20+, TypeScript (Strict), **Fastify** (Performance/Schema-first), **Zod** (Validation), **Argon2** (Hashing), **Jose** (JWT), **Sequelize** (Repository Pattern), **TSyringe** (DI).

#### Project Structure
```text
src/
├── domain/                 # Pure Business Logic (Zero Dependencies)
│   ├── entities/
│   ├── value-objects/
│   ├── repositories/       # Interfaces (Ports)
│   ├── errors/
│   └── events/
├── application/            # Use Cases (Orchestration)
│   ├── dtos/
│   ├── ports/              # Interfaces for Infra (Crypto, Token, Tx)
│   └── use-cases/
├── infrastructure/         # Adapters (Implement Ports)
│   ├── persistence/sequelize/
│   ├── security/
│   └── config/
├── presentation/           # HTTP Layer
│   ├── routes/
│   ├── schemas/            # Zod Schemas (OpenAPI Gen)
│   └── hooks/
└── main.ts                 # Composition Root
```

---

### 1. Domain Layer (`src/domain`)

#### `value-objects/Email.ts`
```typescript
export class Email {
  private constructor(public readonly value: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new InvalidEmailError(value);
    }
  }
  static create(value: string): Email { return new Email(value.toLowerCase().trim()); }
  equals(other: Email): boolean { return this.value === other.value; }
  toString(): string { return this.value; }
}
export class InvalidEmailError extends Error { constructor(v: string) { super(`Invalid email format: ${v}`); this.name = 'InvalidEmailError'; } }
```

#### `value-objects/Password.ts`
```typescript
// Represents the *policy*, not the hash. Hashing is infra concern.
export class PlainPassword {
  private constructor(public readonly value: string) {
    if (value.length < 12) throw new WeakPasswordError('Min 12 chars');
    if (!/[A-Z]/.test(value)) throw new WeakPasswordError('Requires uppercase');
    if (!/[a-z]/.test(value)) throw new WeakPasswordError('Requires lowercase');
    if (!/[0-9]/.test(value)) throw new WeakPasswordError('Requires number');
    if (!/[^A-Za-z0-9]/.test(value)) throw new WeakPasswordError('Requires special char');
  }
  static create(value: string): PlainPassword { return new PlainPassword(value); }
}
export class WeakPasswordError extends Error { constructor(msg: string) { super(msg); this.name = 'WeakPasswordError'; } }
```

#### `entities/User.ts`
```typescript
import { Email } from '../value-objects/Email';
import { Role } from './Role';

export class User {
  public readonly id: string; // UUID
  public readonly username: string;
  public readonly email: Email;
  private readonly _passwordHash: string; // Encapsulated
  private readonly _roles: Role[] = [];
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: User.Props) {
    Object.assign(this, props);
  }

  static create(props: User.CreateProps): User {
    return new User({
      ...props,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      _roles: [],
    });
  }

  static reconstitute(props: User.Props): User { return new User(props); }

  assignRole(role: Role): void {
    if (!this._roles.some(r => r.id === role.id)) this._roles.push(role);
  }
  get roles(): ReadonlyArray<Role> { return [...this._roles]; }
  verifyPassword(hash: string): boolean { return this._passwordHash === hash; } // Used by repo for hydration check
  
  // Domain Event emission logic would go here
}

export namespace User {
  export interface Props { id: string; username: string; email: Email; _passwordHash: string; _roles: Role[]; createdAt: Date; updatedAt: Date; }
  export interface CreateProps { username: string; email: Email; passwordHash: string; }
}
```

#### `entities/Role.ts`
```typescript
export class