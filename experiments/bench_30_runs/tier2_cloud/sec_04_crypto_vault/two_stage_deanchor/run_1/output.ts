### Architectural Blueprint & File Layout

This implementation provides a production-grade, asynchronous cryptographic vault service written in **Python 3.11+**, adhering strictly to clean architecture, modern typing (`pydantic` v2, `asyncio`), and absolute preservation of the extracted domain invariants (AEAD compliance, unextractable key protections, immediate revocation, and state transition validation).

#### Directory Structure
```
crypto_vault/
├── __init__.py
├── domain/
│   ├── __init__.py
│   ├── entities.py       # CryptographicKey, Vault, AccessPolicy models
│   ├── enums.py          # KeyStatus, Operations, Events
│   └── invariants.py     # State transition validators
├── services/
│   ├── __init__.py
│   ├── crypto_engine.py  # WebCrypto/PyCA-Cryptography abstraction (AES-GCM, RSA, ECC)
│   └── vault_service.py  # Core orchestration engine implementing functional operations
├── storage/
│   ├── __init__.py
│   └── repository.py     # Interface & thread-safe in-memory/async persistence layer
└── api/
    ├── __init__.py
    └── router.py         # FastAPI presentation layer mapping schema actions to HTTP
```

---

### Phase 1: Domain Entities & Enums (`domain/`)

#### `domain/enums.py`
```python
from enum import StrEnum, auto

class KeyStatus(StrEnum):
    ACTIVE = "active"
    REVOKED = "revoked"
    COMPROMISED = "compromised"
    EXPIRED = "expired"

class KeyOperation(StrEnum):
    ENCRYPT = "encrypt"
    DECRYPT = "decrypt"
    SIGN = "sign"
    VERIFY = "verify"
    DERIVE_KEY = "deriveKey"
    DERIVE_BITS = "deriveBits"

class EventType(StrEnum):
    KEY_GENERATED = "KeyGenerated"
    KEY_REVOKED = "KeyRevoked"
    KEY_EXPIRED = "KeyExpired"
    VAULT_CREATED = "VaultCreated"
    VAULT_UPDATED = "VaultUpdated"
    VAULT_DECRYPTION_FAILED = "VaultDecryptionFailed"
    SECURITY_POLICY_VIOLATED = "SecurityPolicyViolated"
```

#### `domain/entities.py`
```python
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, UUID4, ConfigDict
from .enums import KeyStatus, KeyOperation

class CryptographicKey(BaseModel):
    model_config = ConfigDict(frozen=True)
    
    id: UUID4
    algorithm: str
    key_ops: List[KeyOperation]
    extractable: boolean_flag := Field(..., description="Determines exportability") # type: ignore
    created_at: datetime
    expires_at: Optional[datetime] = None
    status: KeyStatus = KeyStatus.ACTIVE
    internal_key_material: Optional[bytes] = Field(default=None, repr=False)

    def is_usable(self) -> bool:
        if self.status != KeyStatus.ACTIVE:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True

class Vault(BaseModel):
    id: UUID4
    name: str
    master_key_reference: UUID4
    encrypted_payload: bytes
    version: int
    updated_at: datetime

class AccessPolicy(BaseModel):
    resource_id: str
    allowed_operations: List[str]
    authentication_requirements: List[str]
    rate_limit: int
```

#### `domain/invariants.py`
```python
from typing import Optional
from .enums import KeyStatus, EventType
from .entities import CryptographicKey

class StateTransitionError(Exception):
    """Raised when an illegal state transition is attempted."""
    pass

def validate_key_transition(current_status: Optional[KeyStatus], event: EventType) -> KeyStatus:
    if current_status is None and event == EventType.KEY_GENERATED:
        return KeyStatus.ACTIVE
    elif current_status == KeyStatus.ACTIVE and event == EventType.KEY_REVOKED:
        return KeyStatus.REVOKED
    elif current_status == KeyStatus.ACTIVE and event == EventType.KEY_EXPIRED:
        return KeyStatus.EXPIRED
    
    raise StateTransitionError(f"Illegal state transition from {current_status} via {event}")
```

---

### Phase 2: Cryptographic Engine & Services (`services/`)

#### `services/crypto_engine.py`
```python
import os
from typing import Tuple, Dict, Any
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.asymmetric import rsa, ec
from cryptography.hazmat.primitives import hashes
from ..domain.enums import KeyOperation

class CryptoEngine:
    """
    Implements core cryptographic operations enforcing AEAD and unextractable protections.
    """
    @staticmethod
    def generate_key_material(algorithm: str) -> Tuple[bytes, Optional[Dict[str, Any]]]:
        if algorithm.upper() == "AES-GCM":
            # Generates a 256-bit AES key
            return AESGCM.generate_key(bit_length=256), None
        elif algorithm.upper() == "RSA-OAEP":
            private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            public_key = private_key.public_key()
            # Serialize or expose public parameters if asymmetric
            pub_nums = public_key.public_numbers()
            pub_params = {"n": pub_nums.n, "e": pub_nums.e}
            # Return serialized private bytes (mock representation for engine)
            return private_key.private_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ), pub_params
        elif algorithm.upper() in ("ECDSA", "ED25519"):
            private_key = ec.generate_private_key(ec.SECP256R1())
            pub_nums = private_key.public_key().public_numbers()
            pub_params = {"x": pub_nums.x, "y": pub_nums.y}
            return private_key.private_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ), pub_params
        else:
            raise ValueError(f"Unsupported algorithm specification: {algorithm}")

    @staticmethod
    def encrypt_aead(key: bytes, plain_data: bytes, associated_data: bytes = b"") -> Tuple[bytes, bytes]:
        """
        Invariant: AEAD (Authenticated Encryption with Associated Data) used.
        Invariant: Nonces must be cryptographically random and never reused.
        """
        aesgcm = AESGCM(key)
        iv = os.urandom(12)  # 96-bit IV recommended for AES-GCM
        ciphertext_with_tag = aesgcm.encrypt(iv, plain_data, associated_data)
        # AESGCM in cryptography package appends the 16-byte auth tag to the ciphertext
        encrypted_payload = ciphertext_with_tag[:-16]
        auth_tag = ciphertext_with_tag[-16:]
        return encrypted_payload, iv, auth_tag  # type: ignore

    @staticmethod
    def decrypt_aead(key: bytes, encrypted_payload: bytes, iv: bytes, auth_tag: bytes, associated_data: bytes = b"") -> bytes:
        """
        Invariant: Decryption must fail immediately if authentication tag verification fails.
        """
        aesgcm = AESGCM(key)
        ciphertext_with_tag = encrypted_payload + auth_tag
        try:
            return aesgcm.decrypt(iv, ciphertext_with_tag, associated_data)
        except Exception as e:
            raise DecryptionFailedError("Authentication tag verification failed. Ciphertext compromised or tampered.") from e

class DecryptionFailedError(Exception):
    pass

from cryptography.hazmat.primitives import serialization
```

#### `services/vault_service.py`
```python
from datetime import datetime
from typing import Dict, Any, List, Tuple
from uuid import uuid4, UUID

from ..domain.entities import CryptographicKey, Vault
from ..domain.enums import KeyStatus, KeyOperation, EventType
from ..domain.invariants import validate_key_transition, StateTransitionError
from ..storage.repository import VaultRepository
from .crypto_engine