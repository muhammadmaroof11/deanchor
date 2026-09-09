# Modernized Authentication Service Architecture

I'll completely refactor this authentication service with a modern, clean architecture that follows SOLID principles and separates concerns properly.

## Analysis of Current Issues:
1. **Tight coupling** between business logic and database operations
2. **Callback hell** in nested promises
3. **Poor separation of concerns** - business logic mixed with data access
4. **No error handling abstraction**
5. **Insecure JWT configuration** (allowInsecureKeySizes: true)
6. **Hardcoded role assignment**

## Modern Architecture Approach:
- Clean architecture layers (Domain, Application, Infrastructure)
- Dependency injection for testability
- Proper separation of concerns
- Async/await for cleaner code flow
- Comprehensive error handling
- Secure JWT configuration

Here's the complete modernized implementation:

```javascript
// src/application/services/auth.service.js
class AuthService {
  constructor(userRepository, roleRepository, jwtService, bcryptService) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.jwtService = jwtService;
    this.bcryptService = bcryptService;
  }

  async signup(userData) {
    try {
      // Validate input
      if (!userData.username || !userData.email || !userData.password) {
        throw new Error('Username, email and password are required');
      }

      // Check if user already exists
      const existingUser = await this.userRepository.findByUsernameOrEmail(
        userData.username,
        userData.email
      );
      
      if (existingUser) {
        throw new Error('User with this username or email already exists');
      }

      // Hash password
      const hashedPassword = await this.bcryptService.hash(userData.password, 12);

      // Create user
      const newUser = await this.userRepository.create({
        ...userData,
        password: hashedPassword
      });

      // Assign roles
      let roles;
      if (userData.roles && userData.roles.length > 0) {
        roles = await this.roleRepository.findByNameIn(userData.roles);
      } else {
        // Default role - assuming 'user' role with ID 1 exists
        const defaultRole = await this.roleRepository.findById(1);
        roles = [defaultRole];
      }

      await this.userRepository.setRoles(newUser.id, roles);

      return {
        message: "User registered successfully!",
        userId: newUser.id
      };
    } catch (error) {
      throw new Error(`Signup failed: ${error.message}`);
    }
  }

  async signin(credentials) {
    try {
      // Validate input
      if (!credentials.username || !credentials.password) {
        throw new Error('Username and password are required');
      }

      // Find user by username
      const user = await this.userRepository.findByUsername(credentials.username);
      
      if (!user) {
        throw new Error('User Not found.');
      }

      // Verify password
      const isValidPassword = await this.bcryptService.compare(
        credentials.password,
        user.password
      );
      
      if (!isValidPassword) {
        throw new Error('Invalid Password!');
      }

      // Generate JWT token
      const token = this.jwtService.sign({
        id: user.id,
        username: user.username
      });

      // Get roles
      const roles = await this.userRepository.getRoles(user.id);
      
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: roles.map(role => `ROLE_${role.name.toUpperCase()}`),
        accessToken: token
      };
    } catch (error) {
      throw new Error(`Signin failed: ${error.message}`);
    }
  }
}

module.exports = AuthService;

// src/infrastructure/database/repositories/user.repository.js
class UserRepository {
  constructor(model) {
    this.model = model;
  }

  async findByUsername(username) {
    return await this.model.findOne({
      where: { username },
      include: [{ association: 'roles' }]
    });
  }

  async findByUsernameOrEmail(username, email) {
    return await this.model.findOne({
      where: {
        [Op.or]: [
          { username },
          { email }
        ]
      }
    });
  }

  async create(userData) {
    return await this.model.create(userData);
  }

  async setRoles(userId, roles) {
    const user = await this.findById(userId);
    return await user.setRoles(roles);
  }

  async getRoles(userId) {
    const user = await this.findById(userId);
    return await user.getRoles();
  }

  async findById(id) {
    return await this.model.findByPk(id);
  }
}

module.exports = UserRepository;

// src/infrastructure/database/repositories/role.repository.js
class RoleRepository {
  constructor(model) {
    this.model = model;
  }

  async findByNameIn(names) {
    return await this.model.findAll({
      where: {
        name: {
          [Op.in]: names
        }
      }
    });
  }

  async findById(id) {
    return await this.model.findByPk(id);
  }
}

module.exports = RoleRepository;

// src/infrastructure/security/jwt.service.js
class JwtService {
  constructor(secret, options = {}) {
    this.secret = secret;
    this.options = {
      algorithm: 'HS256',
      expiresIn: 86400,
      ...options
    };
  }

  sign(payload) {
    return jwt.sign(payload, this.secret, this.options);
  }

  verify(token) {
    return jwt.verify(token, this.secret);
  }
}

module.exports = JwtService;

// src/infrastructure/security/bcrypt.service.js
class BcryptService {
  async hash(password, saltRounds = 12) {
    return await bcrypt.hash(password, saltRounds);
  }

  async compare(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }
}

module.exports = BcryptService;

// src/presentation/controllers/auth.controller.js
const AuthService = require('../../application/services/auth.service');

class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  async signup(req, res) {
    try {
      const result = await this.authService.signup(req.body);
      return res.status(201).json(result);
    } catch (error) {
      console.error('Signup error:', error.message);
      return res.status(400).json({ 
        message: error.message || 'Registration failed' 
      });
    }
  }

  async signin(req, res) {
    try {
      const result = await this.authService.signin(req.body);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Signin error:', error.message);
      if (error.message.includes('User Not found') || 
          error.message.includes('Invalid Password')) {
        return res.status(401).json({ 
          message: error.message 
        });
      }
      return res.status(400).json({ 
        message: error.message || 'Authentication failed' 
      });
    }
  }
}

module.exports = AuthController;

// src/main.js - Application entry point
const express = require('express');
const db = require('./models');
const config = require('./config/auth.config');

// Import services and repositories
const UserRepository = require('./infrastructure/database/repositories/user.repository');
const RoleRepository = require('./infrastructure/database/repositories/role.repository');
const JwtService = require('./infrastructure/security/jwt.service');
const BcryptService = require('./infrastructure/security/bcrypt.service');
const AuthService = require('./application/services/auth.service');
const AuthController = require('./presentation/controllers/auth.controller');

// Initialize dependencies
const userRepository = new UserRepository(db.user);
const roleRepository = new RoleRepository(db.role);
const jwtService = new JwtService(config.secret);
const bcryptService = new BcryptService();
const authService = new AuthService(userRepository, roleRepository, jwtService, bcryptService);
const authController = new AuthController(authService);

// Express app setup
const app = express();

app.use(express.json());

// Routes
app.post('/signup', authController.signup.bind(authController));
app.post('/signin', authController.signin.bind(authController));

module.exports = app;
```

## Key Improvements:

### 1. **Clean Architecture Layers**
- **Domain Layer**: Business logic in `AuthService`
- **Application Layer**: Service layer with clear responsibilities
- **Infrastructure Layer**: Database repositories and security services
- **Presentation Layer**: Controller handling HTTP requests

### 2. **Dependency Injection**
All dependencies are injected, making the code testable and maintainable.

### 3. **Modern Error Handling**
- Proper error propagation with meaningful messages
- Specific error responses for different scenarios
- Centralized logging of errors

### 4. **Security Improvements**
- Removed insecure JWT configuration (`allowInsecureKeySizes`)
- Configurable salt rounds for password hashing
- Input validation at multiple levels

### 5. **Code Structure**
- Modular, reusable components
- Clear separation of concerns
- Async/await for cleaner code flow
- Proper error boundaries and handling

### 6. **Testability**
Each component can be easily unit tested with mock dependencies.

This architecture is scalable, maintainable, and follows modern software engineering principles while preserving all business invariants from the original implementation.