# Modernized Authentication Service Implementation

I'll create a clean, modern architecture for the authentication service with proper separation of concerns, dependency injection, and improved error handling.

```javascript
// src/services/authService.js
const { User, Role } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/auth.config');

class AuthService {
  constructor(userModel, roleModel, bcryptLib, jwtLib) {
    this.User = userModel;
    this.Role = roleModel;
    this.bcrypt = bcryptLib;
    this.jwt = jwtLib;
    this.secret = config.secret;
    this.tokenExpiration = 86400; // 24 hours
  }

  /**
   * Registers a new user with optional roles
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Registration result
   */
  async signup(userData) {
    try {
      const { username, email, password, roles } = userData;
      
      // Hash the password
      const hashedPassword = await this.bcrypt.hash(password, 8);
      
      // Create user in database
      const user = await this.User.create({
        username,
        email,
        password: hashedPassword
      });
      
      // Assign roles to user
      let roleIds;
      if (roles && Array.isArray(roles) && roles.length > 0) {
        const foundRoles = await this.Role.findAll({
          where: {
            name: { [this.Sequelize.Op.or]: roles }
          }
        });
        
        roleIds = foundRoles.map(role => role.id);
      } else {
        // Default to user role (id=1)
        roleIds = [1];
      }
      
      await user.setRoles(roleIds);
      
      return {
        message: "User registered successfully!",
        userId: user.id
      };
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Authenticates a user and generates JWT token
   * @param {Object} credentials - User login credentials
   * @returns {Promise<Object>} Authentication result with token
   */
  async signin(credentials) {
    try {
      const { username, password } = credentials;
      
      // Find user by username
      const user = await this.User.findOne({
        where: { username }
      });
      
      if (!user) {
        throw new Error('User Not found.');
      }
      
      // Verify password
      const isValidPassword = await this.bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        throw new Error('Invalid Password!');
      }
      
      // Generate JWT token
      const token = this.jwt.sign(
        { id: user.id },
        this.secret,
        {
          algorithm: 'HS256',
          expiresIn: this.tokenExpiration
        }
      );
      
      // Get user roles
      const roles = await user.getRoles();
      const authorities = roles.map(role => `ROLE_${role.name.toUpperCase()}`);
      
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: authorities,
        accessToken: token
      };
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Validates JWT token
   * @param {string} token - JWT token to validate
   * @returns {Promise<Object>} Decoded token payload
   */
  async verifyToken(token) {
    try {
      return this.jwt.verify(token, this.secret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Gets user by ID with role information
   * @param {number} userId - User identifier
   * @returns {Promise<Object>} User data with roles
   */
  async getUserById(userId) {
    try {
      const user = await this.User.findByPk(userId, {
        include: [{
          model: this.Role,
          as: 'roles',
          attributes: ['id', 'name']
        }]
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles.map(role => role.name)
      };
    } catch (error) {
      throw new Error(`Failed to retrieve user: ${error.message}`);
    }
  }

  /**
   * Updates user password
   * @param {number} userId - User identifier
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Update result
   */
  async updatePassword(userId, oldPassword, newPassword) {
    try {
      const user = await this.User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Verify current password
      const isValidPassword = await this.bcrypt.compare(oldPassword, user.password);
      
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }
      
      // Hash and update new password
      const hashedPassword = await this.bcrypt.hash(newPassword, 8);
      await user.update({ password: hashedPassword });
      
      return { message: 'Password updated successfully' };
    } catch (error) {
      throw new Error(`Failed to update password: ${error.message}`);
    }
  }

  /**
   * Gets Sequelize Op operator for database queries
   */
  get Sequelize() {
    return require('sequelize').Op;
  }
}

module.exports = AuthService;
```

```javascript
// src/controllers/authController.js
const AuthService = require('../services/authService');

class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  /**
   * Handles user registration
   */
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

  /**
   * Handles user authentication
   */
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

  /**
   * Validates JWT token
   */
  async verifyToken(req, res) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }
      
      const decoded = await this.authService.verifyToken(token);
      return res.status(200).json(decoded);
    } catch (error) {
      console.error('Token verification error:', error.message);
      return res.status(401).json({ 
        message: 'Invalid or expired token' 
      });
    }
  }

  /**
   * Gets user profile
   */
  async getProfile(req, res) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const user = await this.authService.getUserById(userId);
      return res.status(200).json(user);
    } catch (error) {
      console.error('Profile retrieval error:', error.message);
      return res.status(400).json({ 
        message: error.message || 'Failed to retrieve profile' 
      });
    }
  }

  /**
   * Updates user password
   */
  async updatePassword(req, res) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const { oldPassword, newPassword } = req.body;
      
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ 
          message: 'Old password and new password are required' 
        });
      }
      
      const result = await this.authService.updatePassword(
        userId, 
        oldPassword, 
        newPassword
      );
      
      return res.status(200).json(result);
    } catch (error) {
      console.error('Password update error:', error.message);
      return res.status(400).json({ 
        message: error.message || 'Failed to update password' 
      });
    }
  }
}

module.exports = AuthController;
```

```javascript
// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const AuthService = require('../services/authService');

// Initialize services
const authService = new AuthService(
  require('../models').User,
  require('../models').Role,
  require('bcryptjs'),
  require('jsonwebtoken')
);

const authController = new AuthController(authService);

// Authentication routes
router.post('/signup', authController.signup.bind(authController));
router.post('/signin', authController.signin.bind(authController));
router.get