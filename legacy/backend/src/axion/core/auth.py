"""JWT issuance + bcrypt password hashing."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from axion.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=settings.bcrypt_rounds)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(
    sub: str,
    *,
    token_type: str,
    ttl: timedelta,
    extra: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": sub,
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
        "type": token_type,
        "iss": "axion",
        "jti": uuid.uuid4().hex,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(
        payload,
        settings.jwt_secret.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )


def create_token_pair(
    user_id: uuid.UUID | str,
    *,
    org_id: uuid.UUID | str | None = None,
    role: str | None = None,
    is_superuser: bool = False,
) -> tuple[str, str, int]:
    """Issue access + refresh tokens. Returns (access, refresh, access_expires_in_seconds)."""
    sub = str(user_id)
    extra: dict[str, Any] = {}
    if org_id:
        extra["org_id"] = str(org_id)
    if role:
        extra["role"] = role
    if is_superuser:
        extra["su"] = True

    access_ttl = timedelta(minutes=settings.jwt_access_ttl_minutes)
    refresh_ttl = timedelta(days=settings.jwt_refresh_ttl_days)

    access = _create_token(sub, token_type="access", ttl=access_ttl, extra=extra)
    refresh = _create_token(sub, token_type="refresh", ttl=refresh_ttl, extra=extra)
    return access, refresh, int(access_ttl.total_seconds())


def decode_token(token: str, *, expected_type: str = "access") -> dict[str, Any]:
    """Decode + validate a JWT. Raises JWTError on tamper/expiration."""
    payload = jwt.decode(
        token,
        settings.jwt_secret.get_secret_value(),
        algorithms=[settings.jwt_algorithm],
    )
    if payload.get("type") != expected_type:
        raise JWTError(f"Wrong token type: expected {expected_type}, got {payload.get('type')}")
    return payload
