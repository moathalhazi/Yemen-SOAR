"""
SOAR Pro Integration Manager - Cryptographic Utilities
AES-256-GCM credential encryption and HMAC signature verification
"""

import os
import hmac
import hashlib
import base64
import secrets
import json
from typing import Optional

import bcrypt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Master encryption key — derived from environment variable
# In production, use a KMS (AWS KMS, HashiCorp Vault, etc.)
_MASTER_KEY_HEX = os.getenv("INTEGRATION_ENCRYPTION_KEY", "")
if not _MASTER_KEY_HEX:
    # Deterministic fallback for development — NOT secure for production
    _MASTER_KEY_HEX = hashlib.sha256(
        os.getenv("JWT_SECRET_KEY", "soar-dev-key-change-me").encode()
    ).hexdigest()

MASTER_KEY = bytes.fromhex(_MASTER_KEY_HEX[:64])  # 32 bytes = AES-256


# ========================================
# API Key Hashing (bcrypt)
# ========================================

def generate_api_key() -> str:
    """Generate a cryptographically secure API key (48 chars, URL-safe)."""
    return secrets.token_urlsafe(36)


def hash_api_key(api_key: str) -> str:
    """Hash an API key using bcrypt for secure storage."""
    return bcrypt.hashpw(api_key.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")


def verify_api_key(api_key: str, hashed: str) -> bool:
    """Verify an API key against its bcrypt hash."""
    try:
        return bcrypt.checkpw(api_key.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ========================================
# HMAC Signature Verification
# ========================================

def compute_hmac_sha256(payload: bytes, secret: str) -> str:
    """Compute HMAC-SHA256 signature for a payload."""
    return hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()


def verify_hmac_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify HMAC-SHA256 signature (constant-time comparison)."""
    expected = compute_hmac_sha256(payload, secret)
    return hmac.compare_digest(expected, signature)


# ========================================
# AES-256-GCM Encryption (credentials at rest)
# ========================================

def encrypt_credential(plaintext: str) -> str:
    """
    Encrypt a credential string with AES-256-GCM.
    Returns base64 encoded: nonce(12 bytes) || ciphertext || tag(16 bytes)
    """
    if not plaintext:
        return ""
    aesgcm = AESGCM(MASTER_KEY)
    nonce = os.urandom(12)  # 96-bit nonce per NIST recommendation
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    # Concatenate nonce + ciphertext+tag, then base64
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_credential(encrypted_b64: str) -> str:
    """
    Decrypt an AES-256-GCM encrypted credential.
    Input is base64 encoded: nonce(12) || ciphertext || tag(16)
    """
    if not encrypted_b64:
        return ""
    raw = base64.b64decode(encrypted_b64)
    nonce = raw[:12]
    ciphertext = raw[12:]
    aesgcm = AESGCM(MASTER_KEY)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")


def encrypt_credentials_json(credentials: dict) -> str:
    """Encrypt a dictionary of credentials as an AES-256-GCM blob."""
    return encrypt_credential(json.dumps(credentials))


def decrypt_credentials_json(encrypted_b64: str) -> dict:
    """Decrypt an AES-256-GCM blob back to a credentials dictionary."""
    plaintext = decrypt_credential(encrypted_b64)
    if not plaintext:
        return {}
    return json.loads(plaintext)


# ========================================
# SHA-256 Payload Fingerprint
# ========================================

def sha256_digest(data: bytes) -> str:
    """Compute SHA-256 hex digest of raw bytes."""
    return hashlib.sha256(data).hexdigest()
