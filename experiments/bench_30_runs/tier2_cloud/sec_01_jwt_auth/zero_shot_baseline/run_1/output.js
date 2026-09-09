Here is a complete, production-ready rewrite using **TypeScript**, **ES Modules**, **Clean Architecture** (Controller → Service → Repository), **Zod** for validation, and modern security practices.

### Project Structure
```text
src/
├── config/
│   └── env.ts                 # Validated environment configuration
├── core/
│   ├── errors/
│   │   ├── AppError.ts        # Base operational error class
│   │   └── index.ts           # Specific error subclasses (AuthError, ValidationError, NotFoundError)
│   ├── middleware/
│   │   ├── errorHandler.ts    # Centralized error handling
│   │   └── validate.ts        # Zod validation middleware
│   └── utils/
│       ├── jwt.ts             # JWT wrapper (sign/verify)
│       └── password.ts        # Bcrypt wrapper (hash/verify)
├── modules/
│   └── auth/
│       ├── dto/
│       │   ├── signup.dto.ts
│       │   └── signin.dto.ts
│       ├── repositories/
│       │   ├── user.repository.ts
│       │   └── role.repository.ts
│       ├── services/
│       │   └── auth.service.ts
│       ├── controllers/
│       │   └── auth.controller.ts
│       └── routes/
│           └── auth.routes.ts
├── database/
│   ├── models/
│   │   ├── user.model.ts
│   │   └── role.model.ts
│   └── sequelize.ts           # Sequelize initialization
└── app.ts                     # Express app setup
```

---

### 1. Configuration & Core Utilities

#### `src/config/env.ts`
```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'), // e.g., '24h', '7d'
  JWT_ISSUER: z.string().default('clean-architecture-api'),
  JWT_AUDIENCE: z.string().default('clean-architecture-client'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().min(10).max(15).default(12),
  DB_DIALECT: z.enum(['mysql', 'postgres', 'sqlite', 'mariadb']).default('mysql'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(3306),
  DB_NAME: z.string().default('app_db'),
  DB_USER: z.string().default('root'),
  DB_PASS: z.string().default(''),
});

export const env = envSchema.parse(process.env);
```

#### `src/core/utils/password.ts`
```typescript
import bcrypt from 'bcryptjs';
import { env } from '@/config/env';

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);
```

#### `src/core/utils/jwt.ts`
```typescript
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { env } from '@/config/env';

export interface TokenPayload {
  sub: number; // User ID
  roles: string[]; // e.g., ['ROLE_ADMIN', 'ROLE_USER']
}

const signOptions: SignOptions = {
  algorithm: 'HS256',
  expiresIn: env.JWT_EXPIRES_IN,
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
};

export const signToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.JWT_SECRET as Secret, signOptions);

export const verifyToken = (token: string): TokenPayload =>
  jwt.verify(token, env.JWT_SECRET as Secret, {
    algorithms: ['HS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  }) as TokenPayload;
```

#### `src/core/errors/index.ts`
```typescript
// src/core/errors/AppError.ts
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific Errors
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}
```

#### `src/core/middleware/validate.ts`
```typescript
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '@/core/errors';

export const validate = (schema: AnyZodObject) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({ body: req.body, query: req.query, params: req.params });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError('Validation failed', error.flatten().fieldErrors));
      } else {
        next(error);
      }
    }
  };
```

#### `src/core/middleware/errorHandler.ts`
```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/core/errors';
import { env } from '@/config/env';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Sequelize / DB Errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ status: 'error', message: 'Record already exists' });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ status: 'error', message: 'Database validation failed', details: err.errors });
  }

  console.error('💥 Unhandled Error:', err);

  const message = env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
  return res.status(500).json({ status: 'error