"""Org schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from axion.models.org import OrgRole


class OrgCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    domain: str | None = None
    region: str = "eu-west-3"


class OrgUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    domain: str | None = None
    settings: dict | None = None


class OrgOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    domain: str | None
    region: str
    task_quota_monthly: int
    voice_minutes_monthly: int
    budget_eur_monthly: int
    created_at: datetime


class OrgMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    org_id: uuid.UUID
    role: OrgRole
    created_at: datetime


class OrgInviteRequest(BaseModel):
    email: EmailStr
    role: OrgRole = OrgRole.OPERATOR
