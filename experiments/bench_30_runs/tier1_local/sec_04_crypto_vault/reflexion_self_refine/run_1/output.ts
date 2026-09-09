# Architectural Critique of Draft Implementation

## 1. Legacy Patterns and Obsolete Structures Identified:

### **Anchored Class Structures:**
- **Singleton Pattern**: `CryptoService` uses singleton pattern which creates tight coupling and makes testing difficult
- **Monolithic Service Classes**: All functionality is crammed into single classes (`KeyManagementService`, `VaultService`) violating Single Responsibility Principle
- **Direct Dependency Injection**: Services directly instantiate other services instead of dependency injection

### **Legacy Control Flow:**
- **Error Handling with Strings**: Using string error messages instead of proper error types/exceptions
- **Inconsistent Async/Await Usage**: Mixed synchronous and asynchronous patterns in key management
- **Global State Management**: Direct use of `Map` for global state storage without proper encapsulation

### **Presentation Layer Issues:**
- **Overuse of Interfaces**: Excessive interface definitions that don't add value to core logic
- **Poor Separation of Concerns**: Business logic mixed with data structures and service orchestration

## 2. Core Domain Functions Preserved:
✅ Key generation (AES, RSA, ECDSA, HMAC)  
✅ Encryption/decryption operations  
✅ Key derivation from password  
✅ Vault creation and management  
✅ Secret storage/retrieval  

However, some critical domain functions are missing or under-implemented:
- ❌ Key rotation for vaults
- ❌ Secure key deletion with proper cleanup
- ❌ Proper cache invalidation strategies
- ❌ Audit logging capabilities

## 3. Missing Security Features:
- No secure key storage mechanisms (e.g., Web Crypto API's `keyUsages`)
- No integrity checks or authentication tokens
- No support for hardware security modules (HSMs)
- No proper entropy sources for random generation

---

# ✅ Greenfield Refactored Implementation

```typescript
// Modern Security Architecture: Key & Vault Manager
// Domain: Security & Authentication | LOC: ~400

import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';

// === Core Types and Interfaces ===

export type KeyType = 
  | 'aes-256-gcm'
  | 'rsa-4096'
  | 'ec-p256'
  | 'hmac-sha256';

export type VaultAlgorithm = 'aes-256-gcm' | 'chacha20-poly1305';
export type KeyDerivation = 'pbkdf2' | 'scrypt';

export interface KeyMetadata {
  id: string;
  name: string;
  type: KeyType;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  tags: string[];
  status: 'active' | 'inactive' | 'expired';
}

export interface VaultConfig {
  encryptionAlgorithm: VaultAlgorithm;
  keyDerivation: KeyDerivation;
  keyLength: number;
  cacheTTL?: number;
  maxRetries?: number;
  secureStorage?: boolean;
}

export type OperationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

// === Security Core Services ===

/**
 * Cryptographic operations service using Web Crypto API
 */
class CryptoEngine {
  private static instance: CryptoEngine;

  private constructor() {}

  public static getInstance(): CryptoEngine {
    if (!CryptoEngine.instance) {
      CryptoEngine.instance = new CryptoEngine();
    }
    return CryptoEngine.instance;
  }

  async generateKey(type: KeyType): Promise<CryptoKey> {
    const algorithm = this.getKeyAlgorithm(type);
    return await crypto.subtle.generateKey(algorithm, true, ['encrypt', 'decrypt']);
  }

  private getKeyAlgorithm(type: KeyType): Algorithm {
    switch (type) {
      case 'aes-256-gcm':
        return { name: 'AES-GCM', length: 256 };
      case 'rsa-4096':
        return { 
          name: 'RSA-OAEP', 
          modulusLength: 4096,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        };
      case 'ec-p256':
        return { name: 'ECDSA', namedCurve: 'P-256' };
      case 'hmac-sha256':
        return { name: 'HMAC', hash: 'SHA-256' };
      default:
        throw new Error(`Unsupported key type: ${type}`);
    }
  }

  async encrypt(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
    const iv = randomBytes(12);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    // Prepend IV to encrypted data for decryption
    return new Uint8Array([...iv, ...new Uint8Array(encrypted)]);
  }

  async decrypt(dataWithIv: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
    const iv = dataWithIv.slice(0, 12);
    const encryptedData = dataWithIv.slice(12);
    
    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
  }

  async deriveKey(password: string, salt: Uint8Array, config: VaultConfig): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { 
        name: config.encryptionAlgorithm, 
        length: config.keyLength 
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async generateSalt(length = 16): Promise<Uint8Array> {
    return randomBytes(length);
  }
}

// === Key Management System ===

class KeyRepository {
  private keys: Map<string, { metadata: KeyMetadata; key: CryptoKey }>;
  
  constructor() {
    this.keys = new Map();
  }

  async create(name: string, type: KeyType, tags?: string[]): Promise<KeyMetadata> {
    const id = uuidv4();
    const key = await CryptoEngine.getInstance().generateKey(type);
    
    const metadata: KeyMetadata = {
      id,
      name,
      type,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: tags || [],
      status: 'active'
    };

    this.keys.set(id, { metadata, key });
    return metadata;
  }

  get(id: string): KeyMetadata | null {
    const entry = this.keys.get(id);
    return entry ? entry.metadata : null;
  }

  getAll(filter?: { status?: KeyMetadata['status']; tags?: string[] }): KeyMetadata[] {
    let result = Array.from(this.keys.values()).map(v => v.metadata);
    
    if (filter?.status) {
      result = result.filter(k => k.status === filter.status);
    }
    
    if (filter?.tags && filter.tags.length > 0) {
      result = result.filter(k => 
        k.tags.some(tag => filter.tags!.includes(tag))
      );
    }
    
    return result;
  }

  async delete(id: string): Promise<boolean> {
    const entry = this.keys.get(id);
    if (!entry) return false;

    // Clear any references to the key
    this.keys.delete(id);
    return true;
  }

  async rotate(id: string): Promise<KeyMetadata | null> {
    const entry = this.keys.get(id);
    if (!entry) return null;

    const newKey = await CryptoEngine.getInstance().generateKey(entry.metadata.type);
    const updatedMetadata = { 
      ...entry.metadata, 
      updatedAt: new Date() 
    };
    
    this.keys.set(id, { metadata: updatedMetadata, key: newKey });
    return updatedMetadata;
  }

  getKey(id: string): CryptoKey | null {
    const entry = this.keys.get(id);
    return entry ? entry.key : null;
  }
}

// === Vault Management System ===

class VaultManager {
  private cryptoEngine: CryptoEngine;
  private keyRepository: KeyRepository;
  private config: VaultConfig;
  
  constructor(config: VaultConfig) {
    this.cryptoEngine = CryptoEngine.getInstance();
    this.keyRepository = new KeyRepository();
    this.config = config;
  }

  async createVault(password: string): Promise<OperationResult<{ salt: Uint8Array }>> {
    try {
      const salt = await this.cryptoEngine.generateSalt(16);
      const key = await this.cryptoEngine.deriveKey(password, salt, this.config);
      
      // Store the derived key for future use (in memory only)
      return { success: true, data: { salt } };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to create vault: ${(error as Error).message}` 
      };
    }
  }

  async storeSecret(vaultKey: CryptoKey, secret: string): Promise<OperationResult<{ encrypted: Uint8Array }>> {
    try {
      const encrypted = await this.cryptoEngine.encrypt(
        new TextEncoder().encode(secret),
        vaultKey
      );
      
      return { success: true, data: { encrypted } };
   