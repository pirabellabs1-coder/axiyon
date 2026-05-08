"""Agent schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from axion.models.agent import AgentStatus


class AgentTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    role: str
    category: str
    description: str
    icon: str
    skills: list[str]
    default_tools: list[str]
    price_eur_monthly: int


class AgentInstanceCreate(BaseModel):
    template_slug: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=64)
    config: dict = Field(default_factory=dict)
    enabled_tools: list[str] = Field(default_factory=list)
    custom_prompt: str | None = None
    voice_clone_id: str | None = None
    budget_per_day_eur: int = Field(default=100, ge=0, le=100_000)


class AgentInstanceUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=64)
    config: dict | None = None
    enabled_tools: list[str] | None = None
    custom_prompt: str | None = None
    budget_per_day_eur: int | None = Field(default=None, ge=0, le=100_000)
    status: AgentStatus | None = None


class AgentInstanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    template_slug: str
    name: str
    status: AgentStatus
    config: dict
    enabled_tools: list[str]
    custom_prompt: str | None
    voice_clone_id: str | None
    budget_per_day_eur: int
    health_score: float
    tasks_today: int
    last_run_at: str | None
    created_at: datetime


class AgentRunRequest(BaseModel):
    """Trigger an ad-hoc run on a single agent."""

    objective: str = Field(min_length=1, max_length=4000)
    inputs: dict = Field(default_factory=dict)
    timeout_s: int = Field(default=300, ge=10, le=3600)
