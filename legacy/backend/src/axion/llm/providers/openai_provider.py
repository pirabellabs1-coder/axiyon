"""OpenAI / GPT provider."""
from __future__ import annotations

import json
from typing import Any

from openai import AsyncOpenAI

from axion.config import get_settings
from axion.llm.providers.base import LLMProvider, estimate_cost_eur


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self) -> None:
        settings = get_settings()
        self._client = AsyncOpenAI(api_key=settings.openai_api_key.get_secret_value())

    def supported_models(self) -> list[str]:
        return ["gpt-4o", "gpt-4o-mini"]

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
        messages: list[dict] = [{"role": "system", "content": system}]
        for h in history:
            if h.get("role") == "tool":
                messages.append({
                    "role": "tool",
                    "tool_call_id": h.get("tool_use_id", "unknown"),
                    "content": h.get("content", ""),
                })
            elif h.get("role") in ("user", "assistant"):
                messages.append({"role": h["role"], "content": h.get("content", "")})
        if not history or history[-1].get("role") != "user":
            messages.append({"role": "user", "content": user})

        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": t["name"],
                        "description": t.get("description", ""),
                        "parameters": t.get("parameters") or {"type": "object", "properties": {}},
                    },
                }
                for t in tools
            ]

        resp = await self._client.chat.completions.create(**kwargs)
        choice = resp.choices[0].message
        text = choice.content or ""
        tool_calls: list[dict] = []
        if getattr(choice, "tool_calls", None):
            for tc in choice.tool_calls:
                args = {}
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except Exception:
                    args = {"_raw": tc.function.arguments}
                tool_calls.append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "args": args,
                })

        usage = resp.usage
        tokens_in = usage.prompt_tokens if usage else 0
        tokens_out = usage.completion_tokens if usage else 0
        return {
            "text": text,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "cost_eur": estimate_cost_eur(model, tokens_in, tokens_out),
            "model": model,
            "tool_calls": tool_calls,
        }
