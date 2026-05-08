"""Integration management routes (OAuth flows + token storage)."""
from __future__ import annotations

import base64
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from axion.core import audit
from axion.core.rbac import require_role
from axion.db.session import get_session
from axion.deps import get_current_org_id
from axion.models.integration import Integration, IntegrationKind
from axion.models.org import OrgRole
from axion.schemas.auth import CurrentUser

router = APIRouter()


class IntegrationConnect(BaseModel):
    kind: IntegrationKind
    label: str = Field(min_length=1, max_length=128)
    external_account_id: str
    token: str  # OAuth access token from the callback
    refresh_token: str | None = None
    expires_at: str | None = None
    scopes: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


def _xor_encrypt(plain: str) -> str:
    """Toy reversible encoding. Production uses envelope encryption (KMS + AES-GCM)."""
    key = os.environ.get("AXION_ENCRYPTION_KEY", "axion-dev-key-replace-me").encode()
    raw = plain.encode()
    out = bytes(b ^ key[i % len(key)] for i, b in enumerate(raw))
    return base64.urlsafe_b64encode(out).decode()


@router.get("")
async def list_integrations(
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    rows = await session.scalars(
        select(Integration).where(Integration.org_id == org_id, Integration.is_active.is_(True))
    )
    return [
        {
            "id": str(r.id),
            "kind": r.kind.value,
            "label": r.label,
            "external_account_id": r.external_account_id,
            "scopes": r.scopes,
            "expires_at": r.expires_at,
        }
        for r in rows.all()
    ]


@router.post("", status_code=201)
async def connect_integration(
    payload: IntegrationConnect,
    org_id: uuid.UUID = Depends(get_current_org_id),
    actor: CurrentUser = Depends(require_role(OrgRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> dict:
    integ = Integration(
        org_id=org_id,
        kind=payload.kind,
        label=payload.label,
        external_account_id=payload.external_account_id,
        encrypted_token=_xor_encrypt(payload.token),
        refresh_token=_xor_encrypt(payload.refresh_token) if payload.refresh_token else None,
        expires_at=payload.expires_at,
        scopes=payload.scopes,
        metadata_=payload.metadata,
    )
    session.add(integ)
    await session.flush()

    await audit(
        session,
        org_id=org_id,
        actor_type="user",
        actor_id=str(actor.user_id),
        action="integration.connect",
        resource_type="integration",
        resource_id=str(integ.id),
        payload={"kind": payload.kind.value, "label": payload.label},
    )
    return {"id": str(integ.id), "kind": integ.kind.value, "label": integ.label}


@router.delete("/{integration_id}", status_code=204)
async def disconnect_integration(
    integration_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    actor: CurrentUser = Depends(require_role(OrgRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> None:
    integ = await session.get(Integration, integration_id)
    if not integ or integ.org_id != org_id:
        raise HTTPException(404, "Integration not found")
    integ.is_active = False
    await audit(
        session,
        org_id=org_id,
        actor_type="user",
        actor_id=str(actor.user_id),
        action="integration.disconnect",
        resource_type="integration",
        resource_id=str(integration_id),
    )
