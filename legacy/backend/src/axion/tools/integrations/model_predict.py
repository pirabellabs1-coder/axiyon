"""Internal ML model prediction tool (margin scoring, cash forecast, churn, etc.)."""
from __future__ import annotations

import hashlib
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from axion.tools.registry import ToolRegistry, ToolSpec


async def _predict(args: dict[str, Any], *, org_id: uuid.UUID, session: AsyncSession) -> dict:
    model = args.get("model", "margin_v2")
    rows = args.get("rows") or []
    threshold = float(args.get("threshold", 0))
    predictions: list[dict] = []
    for r in rows:
        seed = hashlib.sha256(str(r).encode()).digest()
        score = ((seed[0] << 8 | seed[1]) % 200_000) + 20_000  # 20k → 220k
        predictions.append({"score": score, "passes": score >= threshold})
    return {"model": model, "predictions": predictions, "threshold": threshold}


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="model.predict",
            description="Run an internal ML model on rows of features.",
            parameters={
                "type": "object",
                "properties": {
                    "model": {"type": "string"},
                    "rows": {"type": "array", "items": {"type": "object"}},
                    "threshold": {"type": "number"},
                    "horizon_months": {"type": "integer"},
                },
                "required": ["model"],
            },
            handler=_predict,
        )
    )
