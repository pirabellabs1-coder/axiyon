"""Email send tool (SendGrid backend in production)."""
from __future__ import annotations

import hashlib
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec

NAME = "email.send"


async def _handler(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    to = args.get("to")
    if not to:
        raise ValueError("'to' is required")
    template = args.get("template", "default")
    seed = hashlib.sha256(f"{to}{template}".encode()).digest()
    replied = seed[0] % 100 < 12  # 12% reply rate, deterministic
    return {
        "message_id": f"msg-{uuid.uuid4().hex[:12]}",
        "to": to,
        "template": template,
        "delivered": True,
        "opened": seed[1] % 100 < 42,
        "replied": replied,
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name=NAME,
            description="Send a templated email to a recipient.",
            parameters={
                "type": "object",
                "properties": {
                    "to": {"type": "string", "format": "email"},
                    "template": {"type": "string"},
                    "vars": {"type": "object"},
                    "subject": {"type": "string"},
                },
                "required": ["to"],
            },
            handler=_handler,
        )
    )
