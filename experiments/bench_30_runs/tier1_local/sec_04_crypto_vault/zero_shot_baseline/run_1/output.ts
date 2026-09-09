```typescript
/**
 * Modern WebCrypto Key & Vault Manager
 * A secure, scalable key management system built on modern TypeScript principles
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';

// === Core Types and Interfaces ===

export interface KeyMetadata {
  id: string;
  name: string;
  type: 'aes-256-gcm' | 'rsa-4096' | 'ec-p256' | 'hmac-sha256';
  created: Date;
  updated: Date;
  expires?: Date;
  tags: string[];
  status: 'active' | 'expired' | 'revoked';
}

export interface KeyMaterial {
  raw: Uint8Array;
  derivedKey?: CryptoKey;
}

export interface VaultConfig {
  defaultAlgorithm: string;
  keyRotationPeriodDays: number;
  maxKeysPerVault: number;
  encryptionContext: Record<string, any>;
}

export interface EncryptionResult {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  tag: Uint8Array;
  algorithm: string;
}

export interface DecryptionResult {
  plaintext: Uint8Array;
  algorithm: string;
}

// === Core Security Utilities ===

class SecurityUtils {
  static async deriveKey(
    password: string,
    salt: Uint8Array,
    iterations: number = 100000
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  static async generateSalt(length: number = 32): Promise<Uint8Array> {
    return randomBytes(length);
  }

  static async hashString(input: string, algorithm: string = 'SHA-256'): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest(algorithm, data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  static generateKeyId(): string {
    return `key-${uuidv4()}`;
  }
}

// === Key Management Core ===

class KeyManager {
  private keys: Map<string, KeyMetadata> = new Map();
  private keyStore: Map<string, KeyMaterial> = new Map();

  constructor(private config: VaultConfig) {}

  async createKey(
    name: string,
    type: 'aes-256-gcm' | 'rsa-4096' | 'ec-p256' | 'hmac-sha256',
    tags: string[] = [],
    expires?: Date
  ): Promise<KeyMetadata> {
    const keyId = SecurityUtils.generateKeyId();
    const now = new Date();

    // Validate key type and generate appropriate material
    let keyMaterial: KeyMaterial;
    
    switch (type) {
      case 'aes-256-gcm':
        keyMaterial = await this.generateAESKey();
        break;
      case 'rsa-4096':
        keyMaterial = await this.generateRSAKey();
        break;
      case 'ec-p256':
        keyMaterial = await this.generateECKey();
        break;
      case 'hmac-sha256':
        keyMaterial = await this.generateHMACKey();
        break;
      default:
        throw new Error(`Unsupported key type: ${type}`);
    }

    const metadata: KeyMetadata = {
      id: keyId,
      name,
      type,
      created: now,
      updated: now,
      expires,
      tags,
      status: 'active'
    };

    this.keys.set(keyId, metadata);
    this.keyStore.set(keyId, keyMaterial);

    return metadata;
  }

  async generateAESKey(): Promise<KeyMaterial> {
    const key = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );

    // Export the raw key material for storage
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    
    return {
      raw,
      derivedKey: key
    };
  }

  async generateRSAKey(): Promise<KeyMaterial> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['encrypt', 'decrypt']
    );

    // Export the raw key material for storage
    const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    
    return {
      raw: new Uint8Array([...new Uint8Array(publicKey), ...new Uint8Array(privateKey)])
    };
  }

  async generateECKey(): Promise<KeyMaterial> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveBits']
    );

    // Export the raw key material for storage
    const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    
    return {
      raw: new Uint8Array(publicKey)
    };
  }

  async generateHMACKey(): Promise<KeyMaterial> {
    const key = await crypto.subtle.generateKey(
      {
        name: 'HMAC',
        hash: 'SHA-256'
      },
      true,
      ['sign', 'verify']
    );

    // Export the raw key material for storage
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    
    return {
      raw,
      derivedKey: key
    };
  }

  async encrypt(
    data: Uint8Array,
    keyId: string,
    additionalData?: Uint8Array
  ): Promise<EncryptionResult> {
    const metadata = this.keys.get(keyId);
    if (!metadata || metadata.status !== 'active') {
      throw new Error(`Key ${keyId} not found or inactive`);
    }

    const keyMaterial = this.keyStore.get(keyId);
    if (!keyMaterial?.derivedKey) {
      throw new Error('Cannot encrypt: Key material unavailable');
    }

    // Generate random IV
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    try {
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
          tagLength: 128,
          additionalData
        },
        keyMaterial.derivedKey!,
        data
      );

      // Extract ciphertext and authentication tag
      const buffer = new Uint8Array(encryptedData);
      const ciphertext = buffer.slice(0, buffer.length - 16);
      const tag = buffer.slice(buffer.length - 16);

      return {
        ciphertext,
        iv,
        tag,
        algorithm: 'AES-GCM'
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  async decrypt(
    encryptedData: Uint8Array,
    iv: Uint8Array,
    tag: Uint8Array,
    keyId: string,
    additionalData?: Uint8Array
  ): Promise<DecryptionResult> {
    const metadata = this.keys.get(keyId);
    if (!metadata || metadata.status !== 'active') {
      throw new Error(`Key ${keyId} not found or inactive`);
    }

    const keyMaterial = this.keyStore.get(keyId);
    if (!keyMaterial?.derivedKey) {
      throw new Error('Cannot decrypt: Key material unavailable');
    }

    try {
      // Reconstruct the full encrypted data with tag
      const fullData = new Uint8Array(encryptedData.length + tag.length);
      fullData.set(encryptedData, 0);
      fullData.set(tag, encryptedData.length);

      const decryptedData = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
          tagLength: 128,
          additionalData
        },
        keyMaterial.derivedKey!,
        fullData
      );

      return {
        plaintext: new Uint8Array(decryptedData),
        algorithm: 'AES-GCM'
      };
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  async rotateKey(keyId: string): Promise<KeyMetadata> {
    const metadata = this.keys.get(keyId);
    if (!metadata) {
      throw new Error(`Key ${keyId} not found`);
    }

    // Create a new key with same properties
    const newMetadata = await this.createKey(
      metadata.name,
      metadata.type,
      metadata.tags,
      metadata.expires
    );

    // Mark old key as revoked
    metadata.status = 'revoked';
    metadata.updated = new Date();

    return