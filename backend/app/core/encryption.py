import base64
import hashlib
from cryptography.fernet import Fernet


def _get_fernet(secret_key: str) -> Fernet:
    key_bytes = hashlib.sha256(secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key_bytes))


def encrypt_key(plaintext: str, secret_key: str) -> str:
    return _get_fernet(secret_key).encrypt(plaintext.encode()).decode()


def decrypt_key(ciphertext: str, secret_key: str) -> str:
    return _get_fernet(secret_key).decrypt(ciphertext.encode()).decode()
