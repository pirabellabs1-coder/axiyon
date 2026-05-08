"""Org management routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from axion.core import audit
from axion.core.rbac import require_role
from axion.db.session import get_session
from axion.deps import get_current_org_id, get_current_user
from axion.models.org import Org, OrgMember, OrgRole
from axion.models.user import User
from axion.schemas.auth import CurrentUser
from axion.schemas.org import (
    OrgInviteRequest,
    OrgMemberOut,
    OrgOut,
    OrgUpdate,
)

router = APIRouter()


@router.get("", response_model=list[OrgOut])
async def list_my_orgs(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[Org]:
    rows = await session.execute(
        select(Org).join(OrgMember).where(OrgMember.user_id == user.user_id)
    )
    return [r[0] for r in rows.all()]


@router.get("/current", response_model=OrgOut)
async def get_current_org(
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> Org:
    org = await session.get(Org, org_id)
    if not org:
        raise HTTPException(404, "Org not found")
    return org


@router.patch("/current", response_model=OrgOut)
async def update_current_org(
    payload: OrgUpdate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    _: CurrentUser = Depends(require_role(OrgRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> Org:
    org = await session.get(Org, org_id)
    if not org:
        raise HTTPException(404, "Org not found")
    if payload.name is not None:
        org.name = payload.name
    if payload.domain is not None:
        org.domain = payload.domain
    if payload.settings is not None:
        org.settings = {**org.settings, **payload.settings}
    await session.flush()
    return org


@router.get("/current/members", response_model=list[OrgMemberOut])
async def list_members(
    org_id: uuid.UUID = Depends(get_current_org_id),
    session: AsyncSession = Depends(get_session),
) -> list[OrgMember]:
    rows = await session.scalars(select(OrgMember).where(OrgMember.org_id == org_id))
    return list(rows.all())


@router.post("/current/invite", response_model=OrgMemberOut, status_code=201)
async def invite_member(
    payload: OrgInviteRequest,
    org_id: uuid.UUID = Depends(get_current_org_id),
    actor: CurrentUser = Depends(require_role(OrgRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> OrgMember:
    user = await session.scalar(select(User).where(User.email == str(payload.email)))
    if not user:
        raise HTTPException(404, f"No user with email {payload.email}. Ask them to sign up first.")

    existing = await session.scalar(
        select(OrgMember).where(
            OrgMember.user_id == user.id, OrgMember.org_id == org_id
        )
    )
    if existing:
        raise HTTPException(409, "User already a member")

    member = OrgMember(user_id=user.id, org_id=org_id, role=payload.role)
    session.add(member)
    await session.flush()

    await audit(
        session,
        org_id=org_id,
        actor_type="user",
        actor_id=str(actor.user_id),
        action="org.member.invite",
        resource_type="org_member",
        resource_id=str(member.id),
        payload={"invited_user_id": str(user.id), "role": payload.role.value},
    )
    return member


@router.delete("/current/members/{member_id}", status_code=204)
async def remove_member(
    member_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    actor: CurrentUser = Depends(require_role(OrgRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> None:
    member = await session.get(OrgMember, member_id)
    if not member or member.org_id != org_id:
        raise HTTPException(404, "Member not found")
    if member.role == OrgRole.OWNER:
        raise HTTPException(403, "Cannot remove the org owner")
    await session.delete(member)
    await audit(
        session,
        org_id=org_id,
        actor_type="user",
        actor_id=str(actor.user_id),
        action="org.member.remove",
        resource_type="org_member",
        resource_id=str(member_id),
    )
