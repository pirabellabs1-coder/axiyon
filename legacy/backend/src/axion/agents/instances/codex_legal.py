"""Codex — in-house counsel. Reviews contracts, escalates above threshold."""
from __future__ import annotations

from axion.agents.base import AgentResult, BaseAgent


class CodexLegal(BaseAgent):
    slug = "legal-counsel"
    name = "Codex"
    role = "Juriste"
    category = "legal"
    icon = "⚖️"
    skills = ["DocuSign", "GDPR", "AI Act", "Ironclad"]
    default_tools = ["contract.analyze", "docusign.send", "kb.search"]
    system_prompt = (
        "You are Codex, an in-house counsel. Flag risks. Cite specific clauses. "
        "NEVER sign contracts above the org's auto-approval threshold without "
        "human sign-off. Default to caution."
    )

    async def run(self) -> AgentResult:
        result = AgentResult(success=False)
        action = self.ctx.inputs.get("action", "review")

        if action == "review":
            return await self._review(result)
        if action == "sign":
            return await self._sign(result)

        result.error = f"Unknown action: {action}"
        return result

    async def _review(self, result: AgentResult) -> AgentResult:
        contract_url = self.ctx.inputs.get("contract_url")
        amount_eur = float(self.ctx.inputs.get("amount_eur", 0))

        analysis = await self.call_tool(
            "contract.analyze",
            {"url": contract_url, "checklist": ["liability", "ip", "termination", "gdpr", "ai_act"]},
        )
        result.tool_calls.append(analysis)
        report = analysis.result or {}
        risks = report.get("risks", [])
        high_risks = [r for r in risks if r.get("severity") == "high"]

        await self.remember(
            f"Reviewed contract {contract_url} (amount={amount_eur}€) — {len(high_risks)} high risks",
            importance=0.6,
        )

        result.success = True
        result.output = {
            "amount_eur": amount_eur,
            "high_risks": high_risks,
            "all_risks": risks,
            "summary": report.get("summary"),
            "recommendation": "approve" if not high_risks else "negotiate",
        }
        result.summary = f"Reviewed contract — {len(high_risks)} high risks"
        return result

    async def _sign(self, result: AgentResult) -> AgentResult:
        amount_eur = float(self.ctx.inputs.get("amount_eur", 0))
        threshold = float(self.ctx.config.get("auto_sign_threshold_eur", 100_000))
        if amount_eur >= threshold:
            return self.request_approval(
                f"Contract amount {amount_eur:.0f}€ exceeds auto-sign threshold {threshold:.0f}€"
            )
        send = await self.call_tool(
            "docusign.send",
            {
                "contract_url": self.ctx.inputs["contract_url"],
                "signers": self.ctx.inputs.get("signers", []),
            },
        )
        result.tool_calls.append(send)
        result.success = send.error is None
        result.output = send.result or {}
        result.summary = f"Sent for signature: {self.ctx.inputs.get('contract_url')}"
        return result
