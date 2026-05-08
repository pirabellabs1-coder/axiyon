"""Generic LLM-driven agent — used for templates without a custom implementation.

Implements a ReAct-style loop: think → choose tool → call → observe → repeat,
up to a configurable max-step. Returns when the model emits a `final_answer`.
"""
from __future__ import annotations

from axion.agents.base import AgentResult, BaseAgent

MAX_STEPS = 12


class GenericAgent(BaseAgent):
    """LLM tool-loop agent used as fallback for catalog templates."""

    async def run(self) -> AgentResult:
        result = AgentResult(success=False)
        history: list[dict] = [
            {"role": "user", "content": self.ctx.objective},
        ]
        tool_specs = self.ctx.tools.openai_specs(self.ctx.enabled_tools)

        for step in range(MAX_STEPS):
            response = await self.ctx.llm.complete(
                system=self.ctx.custom_prompt or self.system_prompt,
                user="\n".join(m["content"] for m in history if m["role"] == "user")[:4000],
                history=history,
                tools=tool_specs,
                max_tokens=2048,
            )
            result.tokens_in += response.get("tokens_in", 0)
            result.tokens_out += response.get("tokens_out", 0)
            result.cost_eur += response.get("cost_eur", 0.0)
            result.model_used = response.get("model")

            tool_calls = response.get("tool_calls") or []
            if not tool_calls:
                # Final answer
                result.success = True
                result.summary = response.get("text", "")[:1000]
                result.output = {"answer": response.get("text", "")}
                break

            for tc in tool_calls:
                call = await self.call_tool(tc["name"], tc.get("args", {}))
                result.tool_calls.append(call)
                history.append(
                    {
                        "role": "tool",
                        "name": tc["name"],
                        "content": str(call.result if call.error is None else f"ERROR: {call.error}"),
                    }
                )
        else:
            result.success = False
            result.error = f"Max steps ({MAX_STEPS}) reached without final answer"

        return result
