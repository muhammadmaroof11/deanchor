### Strict Architectural Critique of the Prior Draft

While the previous draft introduced a clean layered structure (Repositories, Services, Controllers), it suffered from several architectural and idiomatic anti-patterns:

1. **Procedural Classes ("Service/Controller Classes"):** Wrapping procedural functions inside stateless ES6 classes (`class AuthService`, `class AuthController`) is a common anti-pattern in Node.js known as "Java-itis." It forces unnecessary `this` binding (`this.signup = this.signup.bind(this)`), adds boilerplate, and provides zero object-oriented benefits since these classes maintain no internal state.
2. **Leaky Error Handling & Primitive Abuse:** Throwing raw `Error` objects and dynamically attaching HTTP properties (`error.statusCode = 404`, `error.accessToken = null`) inside the service layer violates architectural boundaries. The business layer should remain completely agnostic of HTTP transport concepts like status codes or transport payloads (`accessToken: null`).
3. **Manual Dependency Injection Boilerplate:** Instantiating dependencies directly inside route files (`new UserRepository()`, `new AuthService()`) tightly couples the composition root to individual route definitions and creates friction for testing.
4. **Sub-optimal ORM Query Pattern:** In the signin flow, the legacy code fetched the user *without* roles, and then executed an async `user.getRoles()` query separately. The repository draft fetched them with an include, but the mapping logic (`user.roles.map(...)`) was brittle and lacked type safety around missing associations.

---

### Greenfield Modern Architecture Redesign

To achieve peak maintainability, absolute separation of concerns, and idiomatic modern Node.js engineering, we pivot to a **Functional Core, Imperative Shell** paradigm using **ES Modules**, **functional modules** (instead of stateless classes), **domain-driven custom errors**, and a **clean error-handling middleware architecture**.

#### Target Directory Structure
```
src/
├── config/             # Environment variables & constants
├── errors/             # Custom domain & operational errors
├── loaders/            # Database initialization
├── models/             # Sequelize ORM definitions
├── repositories/       # Data Access (Pure Async Functions/Objects)
├── services/           # Business Logic (Pure Async Functions/Objects)
├── controllers/        # HTTP Transport Adapters
├── middlewares/        # Global Error Handling & Validation
└── routes/             # API Router composition
```

---

### Implementation

#### 1. Configuration (`src/config/environment.js`)
```javascript
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  auth: {
    secret: process.env.JWT_SECRET || 'insecure_development_secret',
    jwtExpiration: '24h',
    defaultRoleId: 1,
    saltRounds: 10
  }
};
```

#### 2. Domain Errors (`src/errors/domain.errors.js`)
Decouples business exceptions from HTTP transport logic while preserving semantic error states.
```javascript
export class DomainError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized access') {
    super(message, 401);
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}
```

#### 3. Data Access Layer - Repository (`src/repositories/user.repository.js`)
Exposes pure data-fetching operations using a functional module pattern.
```javascript
import { Op } from 'sequelize';
import db from '../models/index.js';

const { user: User, role: Role } = db;

export const userRepository = {
  async create({ username, email, password }) {
    return User.create({ username, email, password });
  },

  async findByUsername(username) {
    return User.findOne({
      where: { username },
      include: [{ model: Role, as: 'roles' }]
    });
  },

  async findRolesByNames(roleNames) {
    return Role.findAll({
      where: {
        name: { [Op.or]: roleNames }
      }
    });
  },

  async findRoleById(roleId) {
    return Role.findByPk(roleId);
  }
};
```

#### 4. Business Logic Layer - Service (`src/services/auth.service.js`)
Pure business logic implementation, completely decoupled from HTTP transport.
```javascript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import { NotFoundError, UnauthorizedError } from '../errors/domain.errors.js';

export const createAuthService = (repository) => ({
  async signup({ username, email, password, roles: roleNames }) {
    const hashedPassword = await bcrypt.hash(password, config.auth.saltRounds);

    const user = await repository.create({
      username,
      email,
      password: hashedPassword
    });

    let assignedRoles;
    if (roleNames?.length > 0) {
      assignedRoles = await repository.findRolesByNames(roleNames);
    } else {
      const defaultRole = await repository.findRoleById(config.auth.defaultRoleId);
      assignedRoles = defaultRole ? [defaultRole] : [];
    }

    await user.setRoles(assignedRoles);

    return { message: 'User registered successfully!' };
  },

  async signin({ username, password }) {
    const user = await repository.findByUsername(username);
    if (!user) {
      throw new NotFoundError('User Not found.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid Password!');
    }

    const accessToken = jwt.sign(
      { id: user.id },
      config.auth.secret,
      {
        algorithm: 'HS256',
        allowInsecureKeySizes: true,
        expiresIn: config.auth.jwtExpiration
      }
    );

    const roles = (user.roles || []).map(role => `ROLE_${role.name.toUpperCase()}`);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      roles,
      accessToken
    };
  }
});
```

#### 5. Presentation Layer - Controller (`src/controllers/auth.controller.js`)
Functional controller adapters that translate Express request parameters to service inputs and handle responses.
```javascript
export const createAuthController = (authService) => ({
  async signup(req, res, next) {
    try {
      const result = await authService.signup(req.body);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  async signin(req, res, next) {
    try {
      const result = await authService.signin(req.body);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
});
```

#### 6. Error Handling Middleware (`src/middlewares/error.middleware.js`)
Centralizes error formatting to eliminate repetitive `try/catch` and status code mapping code inside controllers.
```javascript
export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Include accessToken null payload for 401 Unauthorized compliance with legacy API contract
  const payload = { message };
  if (status === 401) {
    payload.accessToken = null;
  }

  return res.status(status).json(payload);
};
```

#### 7. Composition Root & Routing (`src/routes/auth.routes.js`)
Wires dependencies seamlessly without class instantiation bloat.
```javascript
import { Router } from 'express';
import { userRepository } from '../repositories/user.repository.js';
import { createAuthService } from '../services/auth.service.js';
import { createAuthController } from '../controllers/auth.controller.js';

// Wiring Dependencies (Pure Functional Composition)
const authService = createAuthService(userRepository);
const authController = createAuthController(authService);

const router = Router();

router.post('/signup', authController.signup);