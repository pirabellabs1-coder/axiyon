"""Anthropic Claude provider."""
from __future__ import annotations

from typing import Any

from anthropic import AsyncAnthropic

from axion.config import get_settings
from axion.llm.providers.base import LLMProvider, estimate_cost_eur


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self) -> None:
        settings = get_settings()
        self._client = AsyncAnthropic(api_key=settings.anthropic_api_key.get_secret_value())

    def supported_models(self) -> list[str]:
        return ["claude-opus-4-7", "claude-sonnet-4-7", "claude-haiku-4-7"]

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
        # Convert history to Claude messages format
        messages: list[dict] = []
        for h in history:
            if h.get("role") == "tool":
                messages.append({
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": h.get("tool_use_id", "unknown"),
                            "content": h.get("content", ""),
                        }
                    ],
                })
            elif h.get("role") in ("user", "assistant"):
                messages.append({"role": h["role"], "content": h.get("content", "")})
        if not messages or messages[-1]["role"] != "user":
            messages.append({"role": "user", "content": user})

        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": messages,
        }
        if tools:
            kwargs["tools"] = [
                {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "input_schema": t.get("parameters") or t.get("input_schema") or {"type": "object"},
                }
                for t in tools
            ]

        resp = await self._client.messages.create(**kwargs)

        text_parts: list[str] = []
        tool_calls: list[dict] = []
        for block in resp.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "args": block.input or {},
                })

        tokens_in = resp.usage.input_tokens if resp.usage else 0
        tokens_out = resp.usage.output_tokens if resp.usage else 0
        return {
            "text": "".join(text_parts),
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "cost_eur": estimate_cost_eur(model, tokens_in, tokens_out),
            "model": model,
            "tool_calls": tool_calls,
        }
