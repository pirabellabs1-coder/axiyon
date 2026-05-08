"""Tool registry — agents call tools by name; this module routes to handlers."""
from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

ToolHandler = Callable[..., Awaitable[Any]]


@dataclass
class ToolSpec:
    name: str
    description: str
    parameters: dict
    handler: ToolHandler


class ToolRegistry:
    """Holds all callable tools. Bootstrapped on first instantiation."""

    _instance: "ToolRegistry | None" = None

    def __new__(cls) -> "ToolRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._tools = {}
            cls._instance._bootstrap()
        return cls._instance

    _tools: dict[str, ToolSpec]

    def register(self, spec: ToolSpec) -> None:
        self._tools[spec.name] = spec

    def get(self, name: str) -> ToolSpec | None:
        return self._tools.get(name)

    def list_names(self) -> list[str]:
        return sorted(self._tools.keys())

    def openai_specs(self, enabled: list[str]) -> list[dict]:
        """Return tools in the OpenAI/Anthropic-compatible function format."""
        return [
            {
                "name": s.name,
                "description": s.description,
                "parameters": s.parameters,
            }
            for n, s in self._tools.items()
            if not enabled or n in enabled
        ]

    async def call(
        self,
        name: str,
        args: dict[str, Any],
        *,
        org_id: uuid.UUID,
        session: AsyncSession,
    ) -> Any:
        spec = self._tools.get(name)
        if spec is None:
            raise ValueError(f"Unknown tool: {name}")
        return await spec.handler(args, org_id=org_id, session=session)

    def _bootstrap(self) -> None:
        from axion.tools.integrations import (
            apollo,
            calendar,
            docusign,
            email,
            github,
            kb,
            linear,
            linkedin,
            logs,
            model_predict,
            pennylane,
            quickbooks,
            salesforce,
            slack,
            stripe_tool,
            zendesk,
        )
        for module in (
            linkedin,
            apollo,
            email,
            calendar,
            salesforce,
            quickbooks,
            stripe_tool,
            pennylane,
            zendesk,
            slack,
            github,
            linear,
            docusign,
            kb,
            logs,
            model_predict,
        ):
            module.register(self)
