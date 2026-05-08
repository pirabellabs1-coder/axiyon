"""Auth routes: signup, login, refresh, me, logout."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from axion.core import audit
from axion.core.auth import (
    create_token_pair,
    decode_token,
    hash_password,
    verify_password,
)
from axion.db.session import get_session
from axion.deps import get_current_user
from axion.models.org import Org, OrgMember, OrgRole
from axion.models.user import User
from axion.schemas.auth import (
    CurrentUser,
    LoginRequest,
    RefreshRequest,
    TokenPair,
    UserCreate,
    UserOut,
)

router = APIRouter()


def _slugify(s: str) -> str:
    s = re.sub(r"[^\w\s-]", "", s.lower())
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return s[:60] or "org"


@router.post("/signup", response_model=TokenPair, status_code=201)
async def signup(
    payload: UserCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> TokenPair:
    """Create user + initial org + return token pair."""
    existing = await session.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(409, "Email already in use")

    user = User(
        email=str(payload.email),
        full_name=payload.full_name,
        password_hash=hash_password(payload.password.get_secret_value()),
    )
    session.add(user)
    await session.flush()

    org_name = payload.org_name or f"{payload.full_name.split()[0]}'s workspace"
    base_slug = _slugify(org_name)
    slug = base_slug
    n = 1
    while await session.scalar(select(Org).where(Org.slug == slug)):
        n += 1
        slug = f"{base_slug}-{n}"

    org = Org(name=org_name, slug=slug)
    session.add(org)
    await session.flush()

    membership = OrgMember(user_id=user.id, org_id=org.id, role=OrgRole.OWNER)
    session.add(membership)
    await session.flush()

    await audit(
        session,
        org_id=org.id,
        actor_type="user",
        actor_id=str(user.id),
        action="user.signup",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    access, refresh, expires_in = create_token_pair(
        user.id, org_id=org.id, role=OrgRole.OWNER.value
    )
    return TokenPair(access_token=access, refresh_token=refresh, expires_in=expires_in)


@router.post("/login", response_model=TokenPair)
async def login(
    payload: LoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> TokenPair:
    user = await session.scalar(select(User).where(User.email == str(payload.email)))
    if not user or not verify_password(payload.password.get_secret_value(), user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(403, "Account disabled")

    membership = await session.scalar(
        select(OrgMember).where(OrgMember.user_id == user.id).limit(1)
    )

    org_id = membership.org_id if membership else None
    role = membership.role.value if membership else None

    if org_id:
        await audit(
            session,
            org_id=org_id,
            actor_type="user",
            actor_id=str(user.id),
            action="user.login",
            resource_type="user",
            resource_id=str(user.id),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )

    access, refresh, expires_in = create_token_pair(
        user.id, org_id=org_id, role=role, is_superuser=user.is_superuser
    )
    return TokenPair(access_token=access, refresh_token=refresh, expires_in=expires_in)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest) -> TokenPair:
    try:
        decoded = decode_token(payload.refresh_token, expected_type="refresh")
    except JWTError as e:
        raise HTTPException(401, f"Invalid refresh token: {e}") from e
    access, new_refresh, expires_in = create_token_pair(
        decoded["sub"],
        org_id=decoded.get("org_id"),
        role=decoded.get("role"),
        is_superuser=decoded.get("su", False),
    )
    return TokenPair(access_token=access, refresh_token=new_refresh, expires_in=expires_in)


@router.get("/me", response_model=UserOut)
async def me(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> User:
    db_user = await session.get(User, user.user_id)
    if not db_user:
        raise HTTPException(404, "User not found")
    return db_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(user: CurrentUser = Depends(get_current_user)) -> None:
    """Stateless logout — client deletes token. Server-side revocation TBD via Redis denylist."""
    return None
