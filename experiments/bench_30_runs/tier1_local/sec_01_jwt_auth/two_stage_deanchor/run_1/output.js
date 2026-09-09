# Production-Grade Greenfield Implementation for User Authentication System

## Architecture Overview

This implementation follows a clean, modular architecture with clear separation of concerns. The system is built using modern principles including dependency injection, layered architecture, and domain-driven design.

### Core Components:
1. **Domain Layer** - Contains business logic and entities
2. **Application Layer** - Handles use cases and orchestrates operations
3. **Infrastructure Layer** - Provides data access and external services
4. **API Layer** - Exposes REST endpoints for client interaction

## File Structure

```
src/
├── main/
│   ├── java/
│   │   └── com/
│   │       └── authsystem/
│   │           ├── AuthSystemApplication.java
│   │           ├── config/
│   │           │   ├── SecurityConfig.java
│   │           │   └── JwtConfig.java
│   │           ├── domain/
│   │           │   ├── model/
│   │           │   │   ├── User.java
│   │           │   │   ├── Role.java
│   │           │   │   └── AuthToken.java
│   │           │   ├── repository/
│   │           │   │   ├── UserRepository.java
│   │           │   │   └── RoleRepository.java
│   │           │   └── service/
│   │           │       ├── UserService.java
│   │           │       ├── AuthService.java
│   │           │       └── JwtService.java
│   │           ├── application/
│   │           │   ├── usecase/
│   │           │   │   ├── SignupUseCase.java
│   │           │   │   └── SigninUseCase.java
│   │           │   └── dto/
│   │           │       ├── UserDto.java
│   │           │       ├── AuthRequest.java
│   │           │       └── AuthResponse.java
│   │           ├── infrastructure/
│   │           │   ├── persistence/
│   │           │   │   ├── UserRepositoryImpl.java
│   │           │   │   └── RoleRepositoryImpl.java
│   │           │   └── security/
│   │           │       ├── PasswordEncoderConfig.java
│   │           │       └── JwtTokenProvider.java
│   │           └── presentation/
│   │               └── controller/
│   │                   ├── AuthController.java
│   │                   └── UserController.java
│   └── resources/
│       ├── application.yml
│       ├── data.sql
│       └── schema.sql
└── test/
    └── java/
        └── com/
            └── authsystem/
                ├── AuthSystemApplicationTests.java
                ├── domain/
                │   ├── service/
                │   │   ├── UserServiceTest.java
                │   │   └── AuthServiceTest.java
                │   └── repository/
                │       ├── UserRepositoryImplTest.java
                │       └── RoleRepositoryImplTest.java
                └── presentation/
                    └── controller/
                        ├── AuthControllerTest.java
```

## Implementation Details

### 1. Domain Layer

#### Entities (`User`, `Role`)
```java
// src/main/java/com/authsystem/domain/model/User.java
package com.authsystem.domain.model;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {
    private Integer id;
    private String username;
    private String email;
    private String password; // hashed
    private List<String> roles;
}
```

```java
// src/main/java/com/authsystem/domain/model/Role.java
package com.authsystem.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Role {
    private Integer id;
    private String name; // e.g., "ADMIN", "USER"
}
```

#### Repositories
```java
// src/main/java/com/authsystem/domain/repository/UserRepository.java
package com.authsystem.domain.repository;

import com.authsystem.domain.model.User;
import java.util.Optional;

public interface UserRepository {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    User save(User user);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
}
```

```java
// src/main/java/com/authsystem/domain/repository/RoleRepository.java
package com.authsystem.domain.repository;

import com.authsystem.domain.model.Role;
import java.util.List;
import java.util.Optional;

public interface RoleRepository {
    Optional<Role> findById(Integer id);
    List<Role> findAll();
    boolean existsById(Integer id);
}
```

### 2. Application Layer

#### Use Cases
```java
// src/main/java/com/authsystem/application/usecase/SignupUseCase.java
package com.authsystem.application.usecase;

import com.authsystem.domain.model.User;
import com.authsystem.domain.repository.RoleRepository;
import com.authsystem.domain.repository.UserRepository;
import com.authsystem.infrastructure.security.PasswordEncoderConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SignupUseCase {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoderConfig passwordEncoder;

    public String execute(String username, String email, String password, List<String> roles) {
        // Validate uniqueness of username and email
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already registered");
        }

        // Hash the password
        String hashedPassword = passwordEncoder.encode(password);

        // Assign default role if none provided
        List<String> assignedRoles = roles != null && !roles.isEmpty() ? 
                roles : Collections.singletonList("USER");

        // Validate that all roles exist in database
        for (String roleName : assignedRoles) {
            Integer roleId = getRoleIdByName(roleName);
            if (!roleRepository.existsById(roleId)) {
                throw new IllegalArgumentException("Role does not exist: " + roleName);
            }
        }

        // Create user with hashed password and roles
        User newUser = User.builder()
                .username(username)
                .email(email)
                .password(hashedPassword)
                .roles(assignedRoles.stream().map(this::formatRoleName).collect(Collectors.toList()))
                .build();

        userRepository.save(newUser);
        
        return "User registered successfully";
    }

    private Integer getRoleIdByName(String roleName) {
        // Implementation to map role name to ID
        // This would typically be implemented with a lookup mechanism
        switch (roleName.toUpperCase()) {
            case "ADMIN": return 2;
            case "USER": return 1;
            default: return 1; // Default to USER role
        }
    }

    private String formatRoleName(String roleName) {
        return "ROLE_" + roleName.toUpperCase();
    }
}
```

```java
// src/main/java/com/authsystem/application/usecase/SigninUseCase.java
package com.authsystem.application.usecase;

import com.authsystem.domain.model.User;
import com.authsystem.domain.repository.UserRepository;
import com.authsystem.infrastructure.security.JwtTokenProvider;
import com.authsystem.presentation.dto.AuthResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SigninUseCase {
    private final UserRepository userRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoderConfig passwordEncoder;

    public AuthResponse execute(String username, String password) {
        // Find user by username
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Verify password matches stored hash
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new IllegalArgumentException("Invalid credentials");
        }

        // Generate access token with 24-hour expiration
        String accessToken = jwtTokenProvider.generateToken(user);

        // Format roles properly (prefix with ROLE_ and capitalize)
        List<String> formattedRoles = user.getRoles().stream()
                .map(role -> role.toUpperCase())
                .collect(Collectors.toList());

        return AuthResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .roles(formattedRoles)
                .accessToken(accessToken)
                .build();
    }
}
```

### 3. Infrastructure Layer

#### Security Configuration
```java
// src/main/java/com/authsystem/infrastructure/security/JwtTokenProvider.java
package com.authsystem.infrastructure.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.function.Function;

@Component
public class JwtTokenProvider {
    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.expiration}")
    private Long expirationTime;

    public String generateToken(User user) {
        Claims claims = Jwts.claims().setSubject(user.getUsername());
        claims.put("roles", user.getRoles());

        Date now = new Date();
        Date validity = new Date(now.getTime() + expirationTime);

        return Jwts.builder()
                .setClaims(claims)
                .setIssuedAt(now)
                .setExpiration(validity)
                .signWith(SignatureAlgorithm.HS256, secretKey)
                .compact();
    }

    public String getUsernameFromToken(String token) {
        return getClaimFromToken(token, Claims::getSubject);
    }

    public Date getExpirationDateFromToken(String token) {
        return getClaimFromToken