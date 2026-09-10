### Architectural Analysis & Greenfield Redesign Specification

Since the provided source stub represents an abstract 1300-LOC cryptographic and vault management module (`WebCrypto Key & Vault Manager`), we must architect a production-grade, cryptographically sound, and type-safe engine from the ground up. 

#### 1. Fundamental Domain Invariants
* **Zero-Trust Key Material (JWK/CryptoKey)**: Raw key material must never be exposed unencrypted in memory or logs. Keys must be handled strictly via abstract handles or secure asynchronous WebCrypto operations (`CryptoKey`).
* **Authenticated Encryption (AEAD)**: All vault payloads must be encrypted using strong authenticated encryption (`AES-GCM-256` with randomized 96-bit IVs) to guarantee both confidentiality and integrity.
* **Deterministic Key Derivation**: Master vault keys must be derived from user passphrases using memory-hard, brute-force resistant algorithms (`PBKDF2-HMAC-SHA512` with high iteration counts or `Argon2id` if running in WASM contexts; we will use standardized `PBKDF2` over WebCrypto for native browser compatibility).
* **Immutability & Encapsulation**: Vault states, metadata, and entries must be immutable data structures. Mutations must produce new vault states through pure reducer functions.
* **Concurrency & Safety**: Asynchronous cryptographic state transitions must be serialized to prevent race conditions during simultaneous read/write vault operations.

#### 2. Architectural Flaws in Legacy Vault Managers (Typical of 1300-LOC monoliths)
* **Global Mutable State**: Storing decryption keys in module-level variables or plain JavaScript objects.
* **Tight Coupling**: Mixing cryptographic primitives, persistence layers (IndexedDB/LocalStorage), and state management in a single god-class.
* **Inadequate Error Propagation**: Swallowing cryptographic failures (`DOMException`, `OperationError`) into generic boolean flags, leading to opaque debugging.
* **Lack of Strong Typing**: Relying on loose dictionaries for vault payloads instead of branded types and strict schemas.

---

### Modern Greenfield Code Implementation

Below is the complete, modern, TypeScript-based architecture implementing a secure WebCrypto Key & Vault Manager using clean architectural patterns (Domain-Driven Design, Dependency Injection, and functional state transitions).

```typescript
/**
 * @file Secure WebCrypto Key & Vault Manager
 * @architecture Domain-Driven, Clean Architecture, Immutable State Machine
 * @security AES-GCM-256, PBKDF2-SHA512, Strict Type Branding
 */

export namespace VaultDomain {
  // ============================================================================
  // 1. Branded Types & Value Objects
  // ============================================================================

  export type VaultId = string & { readonly __brand: unique symbol };
  export type KeyId = string & { readonly __brand: unique symbol };

  export function createVaultId(id: string = crypto.randomUUID()): VaultId {
    return id as VaultId;
  }

  export function createKeyId(id: string = crypto.randomUUID()): KeyId {
    return id as KeyId;
  }

  export interface VaultMetadata {
    readonly id: VaultId;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly version: number;
  }

  export interface CiphertextPayload {
    readonly iv: string;       // Base64 encoded 96-bit IV
    readonly ciphertext: string; // Base64 encoded encrypted payload
    readonly salt: string;     // Base64 encoded PBKDF2 salt
  }

  export interface VaultEntry {
    readonly id: KeyId;
    readonly name: string;
    readonly key: CryptoKey;
    readonly metadata: Readonly<Record<string, string>>;
  }

  export interface VaultState {
    readonly metadata: VaultMetadata;
    readonly isLocked: boolean;
    readonly entries: ReadonlyMap<KeyId, VaultEntry>;
  }

  // ============================================================================
  // 2. Cryptographic Engine (Pure Functions & WebCrypto)
  // ============================================================================

  const PBKDF2_ITERATIONS = 600000;
  const KEY_LENGTH_BITS = 256;
  const SALT_LENGTH_BYTES = 16;
  const IV_LENGTH_BYTES = 12;

  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  export async function deriveMasterKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passphraseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-512',
      },
      passphraseKey,
      { name: 'AES-GCM', length: KEY_LENGTH_BITS },
      false,
      ['encrypt', 'decrypt']
    );
  }

  export async function encryptData(masterKey: CryptoKey, plainText: string): Promise<CiphertextPayload> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
    const encoder = new TextEncoder();

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      masterKey,
      encoder.encode(plainText)
    );

    return {
      iv: arrayBufferToBase64(iv),
      ciphertext: arrayBufferToBase64(encrypted),
      salt: arrayBufferToBase64(salt),
    };
  }

  export async function decryptData(masterKey: CryptoKey, payload: CiphertextPayload): Promise<string> {
    const iv = base64ToArrayBuffer(payload.iv);
    const ciphertext = base64ToArrayBuffer(payload.ciphertext);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      masterKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  // ============================================================================
  // 3. Vault Storage & Persistence Ports (Interfaces)
  // ============================================================================

  export interface IVaultStorageProvider {
    save(vaultId: VaultId, payload: CiphertextPayload): Promise<void>;
    load(vaultId: VaultId): Promise<CiphertextPayload | null>;
    delete(vaultId: VaultId): Promise<void>;
  }

  // ============================================================================
  // 4. Core Vault Manager (State Machine & Business Logic)
  // ============================================================================

  export class VaultManager {
    private state: VaultState;
    private masterKey: CryptoKey | null = null;

    constructor(vaultId: VaultId = createVaultId()) {
      this.state = {
        metadata: {
          id: vaultId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
        isLocked: true,
        entries: new Map(),
      };
    }

    public getMetadata(): VaultMetadata {
      return this.state.metadata;
    }

    public isLocked(): boolean {
      return this.state.isLocked;
    }

    public async initialize(passphrase: string): Promise<void> {
      const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
      this.masterKey = await deriveMasterKey(passphrase, salt);
      this.state = {
        ...this.state,
        isLocked: false,
        metadata: {
          ...this.state.metadata,
          updatedAt: Date.now(),
        },
      };
    }

    public async unlock(passphrase: string, payload: CiphertextPayload): Promise<void> {
      const salt = new Uint8Array(base64ToArrayBuffer(payload.salt));
      const candidateKey = await deriveMasterKey(passphrase, salt);

      try