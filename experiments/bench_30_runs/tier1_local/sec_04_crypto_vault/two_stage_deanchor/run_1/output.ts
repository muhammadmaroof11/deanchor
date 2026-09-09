# Production-Grade Key Management System Implementation

## Architecture Overview

This implementation follows a clean, modular architecture with clear separation of concerns. The system is built using modern principles including dependency injection, event-driven design, and service-oriented patterns.

### Core Components:
1. **Domain Layer** - Contains core business entities and logic
2. **Service Layer** - Implements functional operations as services
3. **Infrastructure Layer** - Handles persistence and external integrations
4. **API Layer** - Exposes RESTful endpoints for client interaction

## File Structure

```
key-management-system/
├── src/
│   ├── main/
│   │   ├── java/com/example/keymanagement/
│   │   │   ├── domain/
│   │   │   │   ├── entity/
│   │   │   │   │   ├── Key.java
│   │   │   │   │   ├── Vault.java
│   │   │   │   │   ├── User.java
│   │   │   │   │   └── KeyUsageRecord.java
│   │   │   │   ├── repository/
│   │   │   │   │   ├── KeyRepository.java
│   │   │   │   │   ├── VaultRepository.java
│   │   │   │   │   ├── UserRepository.java
│   │   │   │   │   └── KeyUsageRecordRepository.java
│   │   │   │   ├── service/
│   │   │   │   │   ├── KeyService.java
│   │   │   │   │   ├── VaultService.java
│   │   │   │   │   ├── UserService.java
│   │   │   │   │   └── KeyUsageRecordService.java
│   │   │   │   ├── exception/
│   │   │   │   │   ├── KeyNotFoundException.java
│   │   │   │   │   ├── VaultNotFoundException.java
│   │   │   │   │   ├── UserNotFoundException.java
│   │   │   │   │   └── SecurityException.java
│   │   │   │   ├── event/
│   │   │   │   │   ├── KeyLifecycleEvent.java
│   │   │   │   │   ├── VaultLifecycleEvent.java
│   │   │   │   │   └── UserAccessControlEvent.java
│   │   │   │   └── util/
│   │   │   │       ├── CryptoUtils.java
│   │   │   │       └── ValidationUtils.java
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   │   ├── JpaKeyRepository.java
│   │   │   │   │   ├── JpaVaultRepository.java
│   │   │   │   │   ├── JpaUserRepository.java
│   │   │   │   │   └── JpaKeyUsageRecordRepository.java
│   │   │   │   ├── security/
│   │   │   │   │   ├── AccessControlService.java
│   │   │   │   │   └── JwtTokenProvider.java
│   │   │   │   └── config/
│   │   │   │       ├── SecurityConfig.java
│   │   │   │       └── ApplicationConfig.java
│   │   │   ├── api/
│   │   │   │   ├── controller/
│   │   │   │   │   ├── KeyController.java
│   │   │   │   │   ├── VaultController.java
│   │   │   │   │   └── UserController.java
│   │   │   │   └── dto/
│   │   │   │       ├── request/
│   │   │   │       │   ├── GenerateKeyPairRequest.java
│   │   │   │       │   ├── EncryptDataRequest.java
│   │   │   │       │   ├── DecryptDataRequest.java
│   │   │   │       │   ├── SignDataRequest.java
│   │   │   │       │   └── VerifySignatureRequest.java
│   │   │   │       └── response/
│   │   │   │           ├── KeyResponse.java
│   │   │   │           ├── VaultResponse.java
│   │   │   │           └── UserResponse.java
│   │   │   └── Application.java
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── data.sql
│   │       └── schema.sql
│   └── test/
│       └── java/com/example/keymanagement/
│           ├── domain/
│           ├── service/
│           └── api/
└── pom.xml
```

## Core Implementation

### 1. Domain Entities

#### Key.java
```java
package com.example.keymanagement.domain.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "keys")
public class Key {
    @Id
    private String id;
    
    private String name;
    
    @Enumerated(EnumType.STRING)
    private KeyType type;
    
    private Integer size;
    
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
    
    @Enumerated(EnumType.STRING)
    private KeyStatus status;
    
    private Map<String, Object> metadata;
    
    @ManyToOne
    @JoinColumn(name = "vault_id")
    private Vault vault;
    
    // Constructors, getters, setters
    
    public enum KeyType {
        RSA, ECDSA, AES
    }
    
    public enum KeyStatus {
        ACTIVE, INACTIVE, EXPIRED
    }
}
```

#### Vault.java
```java
package com.example.keymanagement.domain.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "vaults")
public class Vault {
    @Id
    private String id;
    
    private String name;
    
    private String description;
    
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
    
    @Enumerated(EnumType.STRING)
    private VaultStatus status;
    
    private String encryptionKey;
    
    private Map<String, Object> accessPolicy;
    
    @ManyToOne
    @JoinColumn(name = "owner_id")
    private User owner;
    
    // Constructors, getters, setters
    
    public enum VaultStatus {
        OPEN, CLOSED, LOCKED
    }
}
```

#### User.java
```java
package com.example.keymanagement.domain.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "users")
public class User {
    @Id
    private String id;
    
    private String username;
    
    private String email;
    
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
    
    @Enumerated(EnumType.STRING)
    private UserStatus status;
    
    @ElementCollection
    private List<String> roles;
    
    // Constructors, getters, setters
    
    public enum UserStatus {
        ACTIVE, INACTIVE, SUSPENDED
    }
}
```

#### KeyUsageRecord.java
```java
package com.example.keymanagement.domain.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "key_usage_records")
public class KeyUsageRecord {
    @Id
    private String id;
    
    private String keyId;
    
    private String userId;
    
    @Enumerated(EnumType.STRING)
    private OperationType operationType;
    
    private LocalDateTime timestamp;
    
    private Map<String, Object> context;
    
    private Boolean success;
    
    // Constructors, getters, setters
    
    public enum OperationType {
        ENCRYPT, DECRYPT, SIGN, VERIFY, GENERATE
    }
}
```

### 2. Service Layer

#### KeyService.java
```java
package com.example.keymanagement.domain.service;

import com.example.keymanagement.domain.entity.Key;
import com.example.keymanagement.domain.repository.KeyRepository;
import com.example.keymanagement.domain.exception.KeyNotFoundException;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class KeyService {
    private final KeyRepository keyRepository;
    
    public KeyService(KeyRepository keyRepository) {
        this.keyRepository = keyRepository;
    }
    
    public Key generateKeyPair(String name, Key.KeyType type, Integer size) {
        // Implementation for generating key pair with validation
        return null; // Placeholder implementation
    }
    
    public Key storeKey(Key key, String vaultId) {
        // Implementation for storing key in vault with access control checks
        return null; // Placeholder implementation
    }
    
    public Key retrieveKey(String keyId, String userId) {
        Optional<Key> key = keyRepository.findById(keyId);
        if (!key.isPresent()) {
            throw new KeyNotFoundException("Key not found: " + keyId);
        }
        
        // Access control check here
        
        return key.get();
    }
    
    public List<Key> getKeysByVault(String vaultId) {
        return keyRepository.findByVaultId(vaultId);
    }
}
```

#### VaultService.java
```java
package com.example.keymanagement.domain.service;

import com.example.keymanagement.domain.entity.Vault;
import com.example.keymanagement.domain.repository.VaultRepository;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class VaultService {
    private final VaultRepository vaultRepository;
    
    public VaultService(VaultRepository vaultRepository) {
        this.vaultRepository = vaultRepository;
    }
    
    public Vault createVault(String name, String description,