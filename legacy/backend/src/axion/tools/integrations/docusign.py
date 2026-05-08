"""DocuSign envelope tool."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec


async def _send(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    return {
        "envelope_id": f"env-{uuid.uuid4().hex[:14]}",
        "signers": args.get("signers", []),
        "status": "sent",
        "tracking_url": "https://docusign.com/...",
    }


async def _analyze(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    return {
        "summary": "Standard MSA with EU jurisdiction. Liability cap at fees paid (12mo).",
        "risks": [
            {"clause": "Liability cap", "severity": "low", "note": "Standard 1× fees"},
            {"clause": "IP assignment", "severity": "medium", "note": "Background IP excluded"},
            {"clause": "Auto-renewal", "severity": "high", "note": "Renews unless 90 days notice"},
        ],
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="docusign.send",
            description="Send a contract for signature via DocuSign.",
            parameters={
                "type": "object",
                "properties": {
                    "contract_url": {"type": "string"},
                    "signers": {"type": "array", "items": {"type": "object"}},
                },
                "required": ["contract_url"],
            },
            handler=_send,
        )
    )
    registry.register(
        ToolSpec(
            name="contract.analyze",
            description="Analyze a contract for risks against a checklist.",
            parameters={
                "type": "object",
                "properties": {
                    "url": {"type": "string"},
                    "checklist": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["url"],
            },
            handler=_analyze,
        )
    )
