"""Хеширование непрозрачных случайных токенов и контекстные HMAC."""

import hashlib
import hmac
import json
import secrets


def new_token() -> str:
    return secrets.token_urlsafe(32)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def keyed_digest(key: str, namespace: str, *values: str) -> str:
    payload = json.dumps([namespace, *values], ensure_ascii=False, separators=(",", ":"))
    return hmac.digest(key.encode(), payload.encode(), "sha256").hex()
