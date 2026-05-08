"""LLM routing layer.

Routes a request to the best available model based on:
- task type (sales / legal / engineering / general)
- latency vs. quality preference
- provider availability
- explicit override

Falls back through the chain on provider error.
"""
from __future__ import annotations

import enum
from dataclasses import dataclass
from typing import Any

import structlog

from axion.config import get_settings
from axion.llm.providers.anthropic_provider import AnthropicProvider
from axion.llm.providers.base import LLMProvider, NullProvider
from axion.llm.providers.mistral_provider import MistralProvider
from axion.llm.providers.openai_provider import OpenAIProvider

log = structlog.get_logger(__name__)
settings = get_settings()


class RoutingPolicy(str, enum.Enum):
    QUALITY = "quality"      # best model regardless of cost
    BALANCED = "balanced"    # default
    CHEAP = "cheap"          # minimize cost
    LATENCY = "latency"      # minimize round-trip


@dataclass
class ModelChoice:
    provider: str
    model: str


_ROUTING: dict[RoutingPolicy, list[ModelChoice]] = {
    RoutingPolicy.QUALITY: [
        ModelChoice("anthropic", "claude-opus-4-7"),
        ModelChoice("openai", "gpt-4o"),
        ModelChoice("mistral", "mistral-large-2"),
    ],
    RoutingPolicy.BALANCED: [
        ModelChoice("anthropic", "claude-sonnet-4-7"),
        ModelChoice("openai", "gpt-4o-mini"),
        ModelChoice("mistral", "mistral-medium"),
    ],
    RoutingPolicy.CHEAP: [
        ModelChoice("openai", "gpt-4o-mini"),
        ModelChoice("anthropic", "claude-haiku-4-7"),
        ModelChoice("mistral", "mistral-small"),
    ],
    RoutingPolicy.LATENCY: [
        ModelChoice("anthropic", "claude-haiku-4-7"),
        ModelChoice("openai", "gpt-4o-mini"),
    ],
}


class LLMRouter:
    """Routes completion requests to the appropriate provider."""

    def __init__(self) -> None:
        self._providers: dict[str, LLMProvider] = {
            "anthropic": AnthropicProvider() if settings.anthropic_api_key.get_secret_value() else NullProvider("anthropic"),
            "openai": OpenAIProvider() if settings.openai_api_key.get_secret_value() else NullProvider("openai"),
            "mistral": MistralProvider() if settings.mistral_api_key.get_secret_value() else NullProvider("mistral"),
        }

    async def complete(
        self,
        *,
        system: str,
        user: str,
        history: list[dict] | None = None,
        tools: list[dict] | None = None,
        max_tokens: int = 2048,
        policy: RoutingPolicy = RoutingPolicy.BALANCED,
        force_model: str | None = None,
    ) -> dict[str, Any]:
        """Run a completion, falling back through the routing chain."""
        if force_model:
            for provider_name, provider in self._providers.items():
                if force_model in provider.supported_models():
                    return await self._call(
                        provider_name, force_model, system, user, history, tools, max_tokens
                    )

        chain = _ROUTING.get(policy, _ROUTING[RoutingPolicy.BALANCED])
        last_error: Exception | None = None
        for choice in chain:
            try:
                return await self._call(
                    choice.provider, choice.model, system, user, history, tools, max_tokens
                )
            except Exception as e:  # noqa: BLE001
                last_error = e
                log.warning(
                    "llm_provider_failed",
                    provider=choice.provider,
                    model=choice.model,
                    error=str(e),
                )
                continue

        # All providers failed: return a no-op shape so agents degrade gracefully
        return {
            "text": f"[LLM unavailable: {last_error}]",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_eur": 0.0,
            "model": "none",
            "tool_calls": [],
        }

    async def _call(
        self,
        provider_name: str,
        model: str,
        system: str,
        user: str,
        history: list[dict] | None,
        tools: list[dict] | None,
        max_tokens: int,
    ) -> dict[str, Any]:
        provider = self._providers[provider_name]
        return await provider.complete(
            system=system,
            user=user,
            history=history or [],
            tools=tools or [],
            max_tokens=max_tokens,
            model=model,
        )
