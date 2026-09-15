/**
 * WebCrypto Cryptographic Vault
 * Origin: diafygi/webcrypto-examples (W3C WebCrypto API)
 * Provides AES-GCM authenticated encryption and RSA-OAEP asymmetric key wrap.
 */

export class CryptoVault {
  private static ALGO_AES = { name: "AES-GCM", length: 256 };
  private static ALGO_RSA = {
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256"
  };

  /** Generate an AES-GCM 256-bit symmetric vault key */
  static async generateSymmetricKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      this.ALGO_AES,
      true,
      ["encrypt", "decrypt"]
    );
  }

  /** Generate an RSA-OAEP keypair for asymmetric key encapsulation */
  static async generateKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      this.ALGO_RSA,
      true,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
    );
  }

  /** Encrypt plaintext buffer with AES-GCM and initialization vector */
  static async encrypt(key: CryptoKey, plaintext: Uint8Array): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      plaintext
    );
    return { ciphertext, iv };
  }

  /** Decrypt ciphertext buffer with AES-GCM */
  static async decrypt(key: CryptoKey, iv: Uint8Array, ciphertext: ArrayBuffer): Promise<ArrayBuffer> {
    return await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );
  }

  /** Wrap (export & encrypt) symmetric key with RSA-OAEP public key */
  static async wrapKey(keyToWrap: CryptoKey, wrappingKey: CryptoKey): Promise<ArrayBuffer> {
    return await crypto.subtle.wrapKey(
      "raw",
      keyToWrap,
      wrappingKey,
      { name: "RSA-OAEP" }
    );
  }

  /** Unwrap (import & decrypt) symmetric key with RSA-OAEP private key */
  static async unwrapKey(wrappedKey: ArrayBuffer, unwrappingKey: CryptoKey): Promise<CryptoKey> {
    return await crypto.subtle.unwrapKey(
      "raw",
      wrappedKey,
      unwrappingKey,
      { name: "RSA-OAEP" },
      this.ALGO_AES,
      true,
      ["encrypt", "decrypt"]
    );
  }
}
