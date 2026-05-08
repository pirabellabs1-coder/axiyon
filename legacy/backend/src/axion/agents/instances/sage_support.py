"""Sage — Tier-2 support agent."""
from __future__ import annotations

from axion.agents.base import AgentResult, BaseAgent


class SageSupport(BaseAgent):
    slug = "support-l2"
    name = "Sage"
    role = "Support Niveau 2"
    category = "support"
    icon = "🎧"
    skills = ["Zendesk", "Intercom", "Logs", "Root cause"]
    default_tools = [
        "zendesk.update",
        "intercom.reply",
        "logs.search",
        "kb.search",
        "linear.create_issue",
    ]
    system_prompt = (
        "You are Sage, a senior Tier-2 support engineer. Solve the customer's problem. "
        "Always verify with logs before suggesting a workaround. Escalate to engineering "
        "(linear.create_issue) only when the issue is reproducible and you have full context."
    )

    async def run(self) -> AgentResult:
        result = AgentResult(success=False)
        ticket_id = self.ctx.inputs.get("ticket_id")
        message = self.ctx.inputs.get("message", self.ctx.objective)

        # 1) Pull recent context
        kb = await self.call_tool("kb.search", {"query": message, "k": 5})
        result.tool_calls.append(kb)

        # 2) If logs hint at error, look them up
        if any(kw in message.lower() for kw in ("error", "fail", "5xx", "timeout", "crash")):
            logs = await self.call_tool(
                "logs.search",
                {"query": message[:200], "since": "1h"},
            )
            result.tool_calls.append(logs)

        # 3) Synthesize response
        response = await self.think(
            f"Ticket: {message}\n\nKB articles: {kb.result}\n\nLogs: " +
            (str(result.tool_calls[-1].result) if len(result.tool_calls) > 1 else "(none)") +
            "\n\nWrite a polite, accurate, end-to-end resolution.",
        )
        result.tokens_in += response.get("tokens_in", 0)
        result.tokens_out += response.get("tokens_out", 0)
        result.cost_eur += response.get("cost_eur", 0.0)
        result.model_used = response.get("model")

        reply_text = response.get("text", "")

        # 4) Post reply
        if ticket_id:
            reply = await self.call_tool(
                "zendesk.update",
                {"ticket_id": ticket_id, "comment": reply_text, "status": "solved"},
            )
            result.tool_calls.append(reply)

        await self.remember(
            f"Resolved ticket {ticket_id}: {message[:120]}",
            importance=0.4,
            metadata={"ticket_id": ticket_id},
        )

        result.success = True
        result.output = {"reply": reply_text, "ticket_id": ticket_id}
        result.summary = f"Resolved ticket {ticket_id or '(adhoc)'}"
        return result
