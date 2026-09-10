Here is a complete greenfield rewrite and modernization of the authentication controller. 

### Architectural Improvements & Modernization

1. **Async/Await & Native Promises**: Eliminated deeply nested callback/promise chains (`.then().then()`) in favor of clean, readable `async/await` syntax.
2. **Robust Error Handling**: Centralized error management using structured try-catch blocks and appropriate HTTP status codes, preventing unhandled promise rejections.
3. **Security Enhancements**: 
   - Uses `bcrypt.hash` (asynchronous) rather than the blocking synchronous version to prevent event loop starvation under high concurrency.
   - Preserved explicit JWT parameters (`HS256`, 24-hour expiration, `allowInsecureKeySizes`).
4. **Separation of Concerns (Service-Controller Pattern)**: Logic is partitioned into a dedicated `AuthService` handling database transactions, password hashing, role resolution, and JWT creation, leaving the controller thin and purely responsible for HTTP handling.
5. **Modern JavaScript/Node Idioms**: Applied ES modules (or modern CommonJS layout), destructuring, and functional array transformations (`map` instead of imperative `for` loops).

---

### Implementation

#### 1. Service Layer (`services/auth.service.js`)
```javascript
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models');
const config = require('../config/auth.config');

const User = db.user;
const Role = db.role;
const Op = db.Sequelize.Op;

const SALT_ROUNDS = 8;
const TOKEN_EXPIRATION = 86400; // 24 hours

class AuthService {
  /**
   * Registers a new user and assigns roles.
   * Invariant: Defaults to role ID 1 if no roles are specified.
   */
  async signup({ username, email, password, roles: roleNames }) {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    let targetRoles;
    if (roleNames && roleNames.length > 0) {
      targetRoles = await Role.findAll({
        where: {
          name: {
            [Op.or]: roleNames,
          },
        },
      });
    } else {
      // Default fallback invariant: Role ID 1
      targetRoles = [1];
    }

    await user.setRoles(targetRoles);
    return { message: 'User registered successfully!' };
  }

  /**
   * Authenticates a user and generates a JWT access token along with formatted authorities.
   */
  async signin({ username, password }) {
    const user = await User.findOne({ where: { username } });
    
    if (!user) {
      const error = new Error('User Not found.');
      error.statusCode = 404;
      throw error;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const error = new Error('Invalid Password!');
      error.statusCode = 401;
      error.accessToken = null;
      throw error;
    }

    const token = jwt.sign(
      { id: user.id },
      config.secret,
      {
        algorithm: 'HS256',
        allowInsecureKeySizes: true,
        expiresIn: TOKEN_EXPIRATION,
      }
    );

    const roles = await user.getRoles();
    const authorities = roles.map(role => `ROLE_${role.name.toUpperCase()}`);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: authorities,
      accessToken: token,
    };
  }
}

module.exports = new AuthService();
```

#### 2. Controller Layer (`controllers/auth.controller.js`)
```javascript
const authService = require('../services/auth.service');

class AuthController {
  /**
   * HTTP Handler for User Registration
   */
  signup = async (req, res) => {
    try {
      const result = await authService.signup(req.body);
      return res.status(200).send(result);
    } catch (err) {
      return res.status(500).send({ message: err.message });
    }
  };

  /**
   * HTTP Handler for User Authentication
   */
  signin = async (req, res) => {
    try {
      const authResult = await authService.signin(req.body);
      return res.status(200).send(authResult);
    } catch (err) {
      const statusCode = err.statusCode || 500;
      const responsePayload = { message: err.message };
      
      if (err.accessToken !== undefined) {
        responsePayload.accessToken = err.accessToken;
      }

      return res.status(statusCode).send(responsePayload);
    }
  };
}

module.exports = new AuthController();
```