## Architectural Critique

### 1. Issues with the Draft Implementation:

**Legacy Presentation Patterns:**
- The draft still uses callback-based patterns in some places (e.g., `user.setRoles(roles).then(...)`)
- Uses traditional Node.js error handling instead of modern async/await consistently
- Maintains the original controller structure that's not truly following clean architecture

**Obsolete Control Flow:**
- Still has nested promise chains where async/await could simplify
- The repository layer still uses Sequelize directly rather than abstracting database operations properly
- Uses `res.status().send()` in controllers instead of proper response handling patterns

**Anchored Class Structures:**
- Repository classes are tightly coupled to Sequelize models
- No clear separation between domain logic and infrastructure concerns
- Controller methods still handle HTTP responses directly instead of delegating to application services

### 2. Core Domain Functions Preserved:
✅ User registration with password hashing  
✅ User authentication with JWT token generation  
✅ Role assignment during signup  
✅ Password validation  

## Fully Revised Greenfield Implementation

```javascript
// src/domain/models/User.js
class User {
  constructor(id, username, email, passwordHash) {
    this.id = id;
    this.username = username;
    this.email = email;
    this.passwordHash = passwordHash;
  }

  static create(username, email, passwordHash) {
    return new User(null, username, email, passwordHash);
  }
}

module.exports = User;

// src/domain/models/Role.js
class Role {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }

  static create(name) {
    return new Role(null, name);
  }
}

module.exports = Role;

// src/domain/repositories/UserRepository.js
class UserRepository {
  async findById(id) { throw new Error('Not implemented'); }
  async findByUsername(username) { throw new Error('Not implemented'); }
  async create(userData) { throw new Error('Not implemented'); }
  async setRoles(userId, roleIds) { throw new Error('Not implemented'); }
  async getRolesForUser(userId) { throw new Error('Not implemented'); }
}

module.exports = UserRepository;

// src/domain/repositories/RoleRepository.js
class RoleRepository {
  async findByName(names) { throw new Error('Not implemented'); }
  async findById(id) { throw new Error('Not implemented'); }
}

module.exports = RoleRepository;

// src/domain/services/AuthService.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthService {
  constructor(userRepo, roleRepo, config) {
    this.userRepo = userRepo;
    this.roleRepo = roleRepo;
    this.config = config;
  }

  async register(userData) {
    // Input validation
    if (!userData.username || !userData.email || !userData.password) {
      throw new Error('Username, email and password are required');
    }

    // Check for existing user
    const existingUser = await this.userRepo.findByUsername(userData.username);
    if (existingUser) {
      throw new Error('Username already taken');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 8);

    // Create user
    const newUser = await this.userRepo.create({
      username: userData.username,
      email: userData.email,
      passwordHash: hashedPassword
    });

    // Assign roles
    let roleIds;
    if (userData.roles && userData.roles.length > 0) {
      const roles = await this.roleRepo.findByName(userData.roles);
      roleIds = roles.map(role => role.id);
    } else {
      const defaultRole = await this.roleRepo.findById(1);
      roleIds = [defaultRole.id];
    }

    await this.userRepo.setRoles(newUser.id, roleIds);

    return { message: 'User registered successfully!' };
  }

  async login(credentials) {
    // Input validation
    if (!credentials.username || !credentials.password) {
      throw new Error('Username and password are required');
    }

    const user = await this.userRepo.findByUsername(credentials.username);
    if (!user) {
      throw new Error('User not found');
    }

    // Password verification
    const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // JWT token generation
    const token = jwt.sign(
      { id: user.id },
      this.config.secret,
      { algorithm: 'HS256', expiresIn: 86400 }
    );

    // Get roles
    const roles = await this.userRepo.getRolesForUser(user.id);
    
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: roles.map(role => `ROLE_${role.name.toUpperCase()}`),
      accessToken: token
    };
  }
}

module.exports = AuthService;

// src/infrastructure/repositories/sequelize/UserRepository.js
const { User } = require('../../../domain/models/User');
const UserRepository = require('../../../domain/repositories/UserRepository');

class SequelizeUserRepository extends UserRepository {
  constructor(db) {
    super();
    this.db = db;
    this.UserModel = db.user;
    this.RoleModel = db.role;
  }

  async findById(id) {
    const user = await this.UserModel.findByPk(id, {
      include: [{ model: this.RoleModel, as: 'roles' }]
    });
    
    if (!user) return null;
    
    return new User(user.id, user.username, user.email, user.password);
  }

  async findByUsername(username) {
    const user = await this.UserModel.findOne({ 
      where: { username },
      include: [{ model: this.RoleModel, as: 'roles' }]
    });
    
    if (!user) return null;
    
    return new User(user.id, user.username, user.email, user.password);
  }

  async create(userData) {
    const user = await this.UserModel.create({
      username: userData.username,
      email: userData.email,
      password: userData.passwordHash
    });
    
    return new User(user.id, user.username, user.email, user.password);
  }

  async setRoles(userId, roleIds) {
    const user = await this.UserModel.findByPk(userId);
    if (!user) throw new Error('User not found');
    
    const roles = await this.RoleModel.findAll({ where: { id: roleIds } });
    await user.setRoles(roles);
  }

  async getRolesForUser(userId) {
    const user = await this.UserModel.findByPk(userId, {
      include: [{ model: this.RoleModel, as: 'roles' }]
    });
    
    if (!user) return [];
    
    return user.roles.map(role => ({ id: role.id, name: role.name }));
  }
}

module.exports = SequelizeUserRepository;

// src/infrastructure/repositories/sequelize/RoleRepository.js
const { Role } = require('../../../domain/models/Role');
const RoleRepository = require('../../../domain/repositories/RoleRepository');

class SequelizeRoleRepository extends RoleRepository {
  constructor(db) {
    super();
    this.db = db;
    this.RoleModel = db.role;
  }

  async findByName(names) {
    const roles = await this.RoleModel.findAll({
      where: { name: names }
    });
    
    return roles.map(role => new Role(role.id, role.name));
  }

  async findById(id) {
    const role = await this.RoleModel.findByPk(id);
    if (!role) return null;
    
    return new Role(role.id, role.name);
  }
}

module.exports = SequelizeRoleRepository;

// src/application/use-cases/RegisterUser.js
class RegisterUser {
  constructor(authService) {
    this.authService = authService;
  }

  async execute(userData) {
    try {
      const result = await this.authService.register(userData);
      return { success: true, data: result };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        code: error.code || 'INTERNAL_ERROR'
      };
    }
  }
}

module.exports = RegisterUser;

// src/application/use-cases/LoginUser.js
class LoginUser {
  constructor(authService) {
    this.authService = authService;
  }

  async execute(credentials) {
    try {
      const result = await this.authService.login(credentials);
      return { success: true, data: result };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        code: error.code || 'INTERNAL_ERROR'
      };
    }
  }
}

module.exports = LoginUser;

// src/presentation/controllers/AuthController.js
const RegisterUser = require('../../application/use-cases/RegisterUser');
const LoginUser = require('../../application/use-cases/LoginUser');

class AuthController {
  constructor(authService, registerUseCase, loginUseCase) {
    this.authService = authService;
    this.registerUseCase = new RegisterUser(authService);
    this.loginUseCase = new LoginUser(authService);
  }

  async signup(req, res) {
    try {
      const result = await this.registerUseCase.execute({
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
        roles: req.body.roles
      });

      if (result.success) {
        return res.status(201).json(result.data);
      }
      
      if (result.error === 'Username already taken') {
        return res.status(409).json({ message: result.error });
      }
      
      return res.status(500).json({ message: result.error });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  async signin(req, res