"""FastAPI dependency injection."""
from __future__ import annotations

import uuid

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from axion.core.auth import decode_token
from axion.db.session import get_session
from axion.schemas.auth import CurrentUser

bearer_scheme = HTTPBearer(auto_error=False)

# Re-export for convenience
__all__ = [
    "DBSession",
    "get_current_user",
    "get_current_org_id",
    "get_session",
]


# Type alias used across routes
DBSession = AsyncSession


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    """Resolve the current user from a Bearer token."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    return CurrentUser(
        user_id=uuid.UUID(payload["sub"]),
        email=payload.get("email", ""),
        org_id=uuid.UUID(payload["org_id"]) if payload.get("org_id") else None,
        role=payload.get("role"),
        is_superuser=bool(payload.get("su", False)),
    )


async def get_current_org_id(
    user: CurrentUser = Depends(get_current_user),
    x_org_id: str | None = Header(default=None, alias="X-Org-Id"),
) -> uuid.UUID:
    """Pick the active org: header override → token claim. Raise if absent."""
    if x_org_id:
        try:
            return uuid.UUID(x_org_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid X-Org-Id") from e
    if user.org_id:
        return user.org_id
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No active organization. Pass X-Org-Id header or include in token.",
    )
