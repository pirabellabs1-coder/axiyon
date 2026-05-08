"""Base agent class. All agent instances inherit from this."""
from __future__ import annotations

import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.llm.router import LLMRouter
from axion.memory.store import MemoryStore
from axion.tools.registry import ToolRegistry


@dataclass
class ToolCall:
    """A single tool invocation by an agent during a task."""

    name: str
    args: dict[str, Any]
    result: Any = None
    error: str | None = None
    started_at: float = field(default_factory=time.time)
    duration_ms: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "args": self.args,
            "result": self.result,
            "error": self.error,
            "duration_ms": self.duration_ms,
        }


@dataclass
class AgentResult:
    """The outcome of an agent task."""

    success: bool
    output: dict[str, Any] = field(default_factory=dict)
    summary: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tokens_in: int = 0
    tokens_out: int = 0
    cost_eur: float = 0.0
    model_used: str | None = None
    error: str | None = None
    next_agent: str | None = None  # for handoff
    requires_approval: bool = False
    approval_reason: str | None = None


@dataclass
class AgentContext:
    """Runtime context handed to an agent during execution."""

    org_id: uuid.UUID
    agent_instance_id: uuid.UUID
    task_id: uuid.UUID
    workflow_run_id: uuid.UUID | None
    objective: str
    inputs: dict[str, Any]
    config: dict[str, Any]
    enabled_tools: list[str]
    custom_prompt: str | None
    budget_remaining_eur: float
    session: AsyncSession
    llm: LLMRouter
    tools: ToolRegistry
    memory: MemoryStore
    trace_id: str = field(default_factory=lambda: uuid.uuid4().hex)


class BaseAgent(ABC):
    """Abstract base. Each agent template implements `run()`."""

    slug: str = ""
    name: str = ""
    role: str = ""
    category: str = ""
    icon: str = "🤖"
    skills: list[str] = []
    default_tools: list[str] = []
    price_eur_monthly: int = 299
    description: str = ""
    system_prompt: str = (
        "You are an autonomous AI employee at the user's company. "
        "Plan, execute, and report results clearly. Escalate when in doubt."
    )

    def __init__(self, ctx: AgentContext) -> None:
        self.ctx = ctx

    @abstractmethod
    async def run(self) -> AgentResult:
        """Execute the agent against `ctx.objective`. Must return AgentResult."""
        raise NotImplementedError

    # ─── Helpers shared by all agents ─────────────────────────────────

    async def think(
        self,
        prompt: str,
        *,
        system: str | None = None,
        tools: list[dict] | None = None,
        max_tokens: int = 2048,
    ) -> dict[str, Any]:
        """Single LLM call with the agent's system prompt + memory retrieval."""
        full_system = system or self.ctx.custom_prompt or self.system_prompt
        recent = await self.ctx.memory.recall(
            org_id=self.ctx.org_id,
            query=self.ctx.objective,
            k=6,
        )
        if recent:
            full_system += "\n\n# Relevant memory\n" + "\n".join(
                f"- {m['summary'] or m['content'][:120]}" for m in recent[:6]
            )
        return await self.ctx.llm.complete(
            system=full_system,
            user=prompt,
            tools=tools,
            max_tokens=max_tokens,
        )

    async def call_tool(self, name: str, args: dict[str, Any]) -> ToolCall:
        """Invoke a registered tool. Records timing + handles errors gracefully."""
        if name not in self.ctx.enabled_tools and name not in self.default_tools:
            tc = ToolCall(name=name, args=args, error=f"Tool '{name}' not enabled for this agent")
            return tc
        tc = ToolCall(name=name, args=args)
        try:
            tc.result = await self.ctx.tools.call(
                name, args, org_id=self.ctx.org_id, session=self.ctx.session
            )
        except Exception as e:  # noqa: BLE001
            tc.error = str(e)
        tc.duration_ms = int((time.time() - tc.started_at) * 1000)
        return tc

    async def remember(
        self, content: str, *, importance: float = 0.5, metadata: dict | None = None
    ) -> None:
        await self.ctx.memory.ingest(
            org_id=self.ctx.org_id,
            agent_id=self.ctx.agent_instance_id,
            content=content,
            importance=importance,
            metadata=metadata or {},
            source=f"agent:{self.slug}",
        )

    def request_approval(self, reason: str) -> AgentResult:
        return AgentResult(
            success=False,
            requires_approval=True,
            approval_reason=reason,
            summary=f"Awaiting human approval: {reason}",
        )

    def handoff(self, target_agent: str, *, summary: str = "", output: dict | None = None) -> AgentResult:
        return AgentResult(
            success=True,
            next_agent=target_agent,
            output=output or {},
            summary=summary or f"Handing off to {target_agent}",
        )
