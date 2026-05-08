"""Base interface for LLM providers."""
from __future__ import annotations

import abc
from typing import Any


class LLMProvider(abc.ABC):
    name: str

    @abc.abstractmethod
    def supported_models(self) -> list[str]:
        ...

    @abc.abstractmethod
    async def complete(
        self,
        *,
        system: str,
        user: str,
        history: list[dict],
        tools: list[dict],
        max_tokens: int,
        model: str,
    ) -> dict[str, Any]:
        """Return {text, tokens_in, tokens_out, cost_eur, model, tool_calls}."""
        ...


class NullProvider(LLMProvider):
    """Returns a deterministic shape — used when no API key is configured.

    Lets dev environments and tests run agents end-to-end without LLM costs.
    """

    def __init__(self, name: str = "null") -> None:
        self.name = name

    def supported_models(self) -> list[str]:
        return ["null-stub"]

    async def complete(
        self,
        *,
        system: str,
        user: str,
        history: list[dict],
        tools: list[dict],
        max_tokens: int,
        model: str,
    ) -> dict[str, Any]:
        return {
            "text": (
                f"[stub:{self.name}] No LLM credentials configured. "
                f"Would have processed: {user[:200]!r}"
            ),
            "tokens_in": len(user) // 4,
            "tokens_out": 32,
            "cost_eur": 0.0,
            "model": f"{self.name}/{model}",
            "tool_calls": [],
        }


# ── Pricing table (€/1M tokens) ──────────────────────────────────
PRICING: dict[str, tuple[float, float]] = {
    # input, output €/1M tokens
    "claude-opus-4-7": (13.50, 67.50),
    "claude-sonnet-4-7": (2.70, 13.50),
    "claude-haiku-4-7": (0.22, 1.10),
    "gpt-4o": (2.30, 9.00),
    "gpt-4o-mini": (0.13, 0.55),
    "mistral-large-2": (1.80, 5.40),
    "mistral-medium": (0.40, 1.20),
    "mistral-small": (0.18, 0.55),
}


def estimate_cost_eur(model: str, tokens_in: int, tokens_out: int) -> float:
    in_rate, out_rate = PRICING.get(model, (0.0, 0.0))
    return (tokens_in * in_rate + tokens_out * out_rate) / 1_000_000
