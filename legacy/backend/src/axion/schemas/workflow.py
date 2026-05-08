"""Workflow schemas."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from axion.models.workflow import WorkflowRunStatus, WorkflowStatus


class WorkflowStepSpec(BaseModel):
    """A single step in a workflow declaration."""

    id: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9_-]+$")
    agent: str = Field(description="Agent template slug or instance name")
    action: str = Field(description="Method to invoke on the agent")
    params: dict[str, Any] = Field(default_factory=dict)
    depends_on: list[str] = Field(default_factory=list)
    timeout_s: int = Field(default=300, ge=10, le=3600)
    retry: int = Field(default=2, ge=0, le=10)
    on_failure: Literal["fail", "continue", "escalate"] = "fail"
    requires_approval: bool = False
    approval_threshold_eur: float | None = None


class WorkflowSpec(BaseModel):
    """Full workflow declaration. JSON-serializable."""

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    schedule_cron: str | None = None
    inputs_schema: dict = Field(default_factory=dict)
    steps: list[WorkflowStepSpec]
    on_blocker: dict = Field(default_factory=dict)  # {escalate_to: email}
    max_cost_eur: float | None = None


class WorkflowCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    spec: WorkflowSpec


class WorkflowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    description: str | None
    version: int
    status: WorkflowStatus
    spec: dict
    schedule_cron: str | None
    created_at: datetime


class WorkflowRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workflow_id: uuid.UUID
    status: WorkflowRunStatus
    started_at: datetime | None
    finished_at: datetime | None
    inputs: dict
    outputs: dict
    cost_eur: float
    error: str | None
    triggered_by: str
    created_at: datetime


class WorkflowRunRequest(BaseModel):
    inputs: dict = Field(default_factory=dict)
    triggered_by: str = "manual"
