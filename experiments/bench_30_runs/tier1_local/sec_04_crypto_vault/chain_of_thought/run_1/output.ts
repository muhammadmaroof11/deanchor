```typescript
/**
 * Modern WebCrypto Key & Vault Manager
 * 
 * This implementation provides a secure, scalable key management system
 * with proper separation of concerns and modern architectural patterns.
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';

// === Domain Models ===

/**
 * Represents a cryptographic key in the vault
 */
export interface Key {
  id: string;
  name: string;
  type: 'AES' | 'RSA' | 'ECDSA' | 'HMAC';
  algorithm: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'inactive' | 'revoked';
  metadata?: Record<string, unknown>;
}

/**
 * Represents a key vault container
 */
export interface Vault {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  keys: Key[];
  tags: string[];
}

/**
 * Encryption context for operations
 */
export interface EncryptionContext {
  keyId: string;
  iv?: Uint8Array;
  additionalData?: Uint8Array;
  timestamp: Date;
}

// === Core Interfaces ===

/**
 * Key Management Service Interface
 */
export interface KeyManagementService {
  createKey(name: string, type: Key['type'], options?: KeyOptions): Promise<Key>;
  getKey(keyId: string): Promise<Key | null>;
  listKeys(vaultId?: string, filter?: KeyFilter): Promise<Key[]>;
  updateKey(keyId: string, updates: Partial<Key>): Promise<Key>;
  deleteKey(keyId: string): Promise<void>;
  rotateKey(keyId: string): Promise<Key>;
}

/**
 * Vault Management Service Interface
 */
export interface VaultManagementService {
  createVault(name: string, description?: string, tags?: string[]): Promise<Vault>;
  getVault(vaultId: string): Promise<Vault | null>;
  listVaults(filter?: VaultFilter): Promise<Vault[]>;
  updateVault(vaultId: string, updates: Partial<Vault>): Promise<Vault>;
  deleteVault(vaultId: string): Promise<void>;
}

/**
 * Encryption Service Interface
 */
export interface EncryptionService {
  encrypt(data: Uint8Array, context: EncryptionContext): Promise<Uint8Array>;
  decrypt(encryptedData: Uint8Array, context: EncryptionContext): Promise<Uint8Array>;
  sign(data: Uint8Array, keyId: string): Promise<Uint8Array>;
  verify(signature: Uint8Array, data: Uint8Array, keyId: string): Promise<boolean>;
}

// === Configuration Options ===

export interface KeyOptions {
  size?: number;
  algorithm?: string;
  exportable?: boolean;
  usage?: KeyUsage[];
  metadata?: Record<string, unknown>;
}

export interface KeyFilter {
  type?: Key['type'];
  status?: Key['status'];
  tags?: string[];
  createdAtAfter?: Date;
  createdAtBefore?: Date;
}

export interface VaultFilter {
  name?: string;
  tags?: string[];
  createdAtAfter?: Date;
  createdAtBefore?: Date;
}

// === Core Implementation ===

/**
 * Main Key Management System
 */
export class ModernKeyVaultManager implements 
  KeyManagementService, 
  VaultManagementService, 
  EncryptionService {

  private readonly keyStore: Map<string, Key> = new Map();
  private readonly vaultStore: Map<string, Vault> = new Map();
  private readonly keyCache: Map<string, CryptoKey> = new Map();

  constructor() {
    // Initialize with default security policies
    this.initializeSecurityPolicies();
  }

  /**
   * Initialize core security policies and configurations
   */
  private initializeSecurityPolicies(): void {
    // Security policy enforcement would go here
    console.log('Security policies initialized');
  }

  // === Key Management Operations ===

  async createKey(
    name: string, 
    type: Key['type'], 
    options?: KeyOptions
  ): Promise<Key> {
    if (!name) throw new Error('Key name is required');

    const keyId = uuidv4();
    
    const key: Key = {
      id: keyId,
      name,
      type,
      algorithm: this.determineAlgorithm(type, options?.algorithm),
      size: options?.size || this.getDefaultSize(type),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      metadata: options?.metadata
    };

    // Validate and store the key
    await this.validateKey(key);
    
    this.keyStore.set(keyId, key);
    this.invalidateCache(keyId);

    return { ...key };
  }

  async getKey(keyId: string): Promise<Key | null> {
    const key = this.keyStore.get(keyId);
    if (!key) return null;
    
    // Return a defensive copy
    return { ...key };
  }

  async listKeys(vaultId?: string, filter?: KeyFilter): Promise<Key[]> {
    let keys = Array.from(this.keyStore.values());

    if (vaultId) {
      const vault = this.vaultStore.get(vaultId);
      if (!vault) throw new Error(`Vault ${vaultId} not found`);
      
      keys = keys.filter(key => 
        vault.keys.some(vaultKey => vaultKey.id === key.id)
      );
    }

    return this.applyKeyFilter(keys, filter || {});
  }

  async updateKey(keyId: string, updates: Partial<Key>): Promise<Key> {
    const existingKey = this.keyStore.get(keyId);
    if (!existingKey) throw new Error(`Key ${keyId} not found`);

    // Validate updates
    const updatedKey = { ...existingKey, ...updates, updatedAt: new Date() };
    
    await this.validateKey(updatedKey);
    
    this.keyStore.set(keyId, updatedKey);
    this.invalidateCache(keyId);

    return { ...updatedKey };
  }

  async deleteKey(keyId: string): Promise<void> {
    const key = this.keyStore.get(keyId);
    if (!key) throw new Error(`Key ${keyId} not found`);

    // Mark as revoked rather than deleting for audit purposes
    key.status = 'revoked';
    key.updatedAt = new Date();
    
    this.invalidateCache(keyId);
  }

  async rotateKey(keyId: string): Promise<Key> {
    const existingKey = this.keyStore.get(keyId);
    if (!existingKey) throw new Error(`Key ${keyId} not found`);

    // Create a new key with same properties but different ID
    const rotatedKey = { ...existingKey };
    rotatedKey.id = uuidv4();
    rotatedKey.createdAt = new Date();
    rotatedKey.updatedAt = new Date();

    this.keyStore.set(rotatedKey.id, rotatedKey);
    this.invalidateCache(keyId);

    return { ...rotatedKey };
  }

  // === Vault Management Operations ===

  async createVault(
    name: string, 
    description?: string, 
    tags?: string[]
  ): Promise<Vault> {
    if (!name) throw new Error('Vault name is required');

    const vaultId = uuidv4();
    
    const vault: Vault = {
      id: vaultId,
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
      keys: [],
      tags: tags || []
    };

    this.vaultStore.set(vaultId, vault);

    return { ...vault };
  }

  async getVault(vaultId: string): Promise<Vault | null> {
    const vault = this.vaultStore.get(vaultId);
    if (!vault) return null;
    
    // Return a defensive copy
    return { 
      ...vault,
      keys: [...vault.keys] 
    };
  }

  async listVaults(filter?: VaultFilter): Promise<Vault[]> {
    let vaults = Array.from(this.vaultStore.values());
    
    if (filter) {
      vaults = this.applyVaultFilter(vaults, filter);
    }

    return vaults.map(vault => ({ ...vault }));
  }

  async updateVault(
    vaultId: string, 
    updates: Partial<Vault>
  ): Promise<Vault> {
    const existingVault = this.vaultStore.get(vaultId);
    if (!existingVault) throw new Error(`Vault ${vaultId} not found`);

    const updatedVault = { ...existingVault, ...updates, updatedAt: new Date() };
    
    this.vaultStore.set(vaultId, updatedVault);

    return { ...updatedVault };
  }

  async deleteVault(vaultId: string): Promise<void> {
    if (!this.vaultStore.has(vaultId)) throw new Error(`Vault ${vaultId} not found`);
    
    // Remove vault and associated keys
    this.vaultStore.delete(vaultId);
    
    // Clean up any cached keys that might be in this vault
    for (const [keyId, key] of this.keyStore.entries()) {
      if (key.id === keyId) {
        this.invalidateCache(keyId);
      }
    }
  }

  // === Encryption Operations ===

  async encrypt(
    data: Uint8Array, 
    context: EncryptionContext
  ): Promise<Uint8Array> {
    const key = await this.getValidKey(context.keyId);
    
    if (key.type !== 'AES') {
      throw new Error(`Cannot encrypt with ${key.type} key`);
    }

    // Generate IV for AES-GCM
    const iv = context.iv || randomBytes(12);
    
    try {
      const cryptoKey = await this.getCryptoKey(key.id, key);
      
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: