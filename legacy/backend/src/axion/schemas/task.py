"""Task schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from axion.models.task import TaskStatus


class TaskCreate(BaseModel):
    agent_id: uuid.UUID
    objective: str = Field(min_length=1, max_length=4000)
    input_payload: dict = Field(default_factory=dict)


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    agent_id: uuid.UUID
    objective: str
    status: TaskStatus
    input_payload: dict
    output_payload: dict
    duration_ms: int | None
    tokens_in: int
    tokens_out: int
    cost_eur: float
    model_used: str | None
    error: str | None
    trace_id: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class TaskListFilters(BaseModel):
    status: TaskStatus | None = None
    agent_id: uuid.UUID | None = None
    workflow_run_id: uuid.UUID | None = None
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)
