"""Atlas — deputy CFO. Margin qualification, monthly close, cash forecast."""
from __future__ import annotations

from axion.agents.base import AgentResult, BaseAgent


class AtlasCFO(BaseAgent):
    slug = "cfo-assistant"
    name = "Atlas"
    role = "CFO Adjoint"
    category = "finance"
    icon = "💼"
    skills = ["QuickBooks", "Pennylane", "Stripe", "Forecasting"]
    default_tools = [
        "quickbooks.lookup",
        "stripe.list_charges",
        "pennylane.export",
        "model.predict",
        "salesforce.lookup",
    ]
    system_prompt = (
        "You are Atlas, a deputy CFO. Be precise. Numbers always tie. "
        "Never approve transactions over thresholds without explicit human sign-off. "
        "When asked to qualify a list of leads on margin, return a structured ranking."
    )

    async def run(self) -> AgentResult:
        action = self.ctx.inputs.get("action") or self.ctx.config.get("default_action") or "monthly_close"
        if action == "qualify_margin":
            return await self._qualify_margin()
        if action == "monthly_close":
            return await self._monthly_close()
        if action == "cash_forecast":
            return await self._cash_forecast()
        return AgentResult(success=False, error=f"Unknown action: {action}")

    async def _qualify_margin(self) -> AgentResult:
        leads = self.ctx.inputs.get("leads", [])
        threshold = float(self.ctx.inputs.get("margin_threshold_eur", 80_000))
        result = AgentResult(success=False)

        # Pull ARR signal for each lead's company
        sf = await self.call_tool(
            "salesforce.lookup",
            {"accounts": [l.get("company") for l in leads]},
        )
        result.tool_calls.append(sf)
        accounts = (sf.result or {}).get("accounts", [])
        by_co = {a.get("name"): a for a in accounts}

        # Predict expected margin
        predict = await self.call_tool(
            "model.predict",
            {
                "model": "margin_v2",
                "rows": [
                    {
                        "company": l.get("company"),
                        "arr_signal": by_co.get(l.get("company"), {}).get("arr"),
                        "industry": l.get("industry"),
                    }
                    for l in leads
                ],
                "threshold": threshold,
            },
        )
        result.tool_calls.append(predict)
        predictions = (predict.result or {}).get("predictions", [])

        passing = [
            {**l, "expected_margin_eur": p.get("score")}
            for l, p in zip(leads, predictions)
            if p.get("passes")
        ]
        passing.sort(key=lambda x: x["expected_margin_eur"], reverse=True)

        next_action = self.ctx.inputs.get("next_action")
        target = int(self.ctx.inputs.get("target_count", len(passing)))
        if next_action and passing:
            return self.handoff(
                "sdr-outbound",
                summary=f"{len(passing)}/{len(leads)} pass margin >= {threshold}€",
                output={"leads": passing[:target], "_origin_action": next_action},
            )

        result.success = True
        result.summary = f"{len(passing)}/{len(leads)} pass margin >= {threshold}€"
        result.output = {"passing": passing, "rejected": len(leads) - len(passing)}
        return result

    async def _monthly_close(self) -> AgentResult:
        result = AgentResult(success=False)
        period = self.ctx.inputs.get("period")
        qb = await self.call_tool("quickbooks.lookup", {"period": period, "report": "trial_balance"})
        result.tool_calls.append(qb)
        stripe = await self.call_tool("stripe.list_charges", {"period": period})
        result.tool_calls.append(stripe)
        export = await self.call_tool("pennylane.export", {"period": period})
        result.tool_calls.append(export)

        await self.remember(f"Monthly close {period} reviewed", importance=0.8)
        result.success = True
        result.summary = f"Monthly close for {period} prepared"
        result.output = {
            "trial_balance": qb.result,
            "stripe_summary": stripe.result,
            "export_url": (export.result or {}).get("url"),
        }
        return result

    async def _cash_forecast(self) -> AgentResult:
        result = AgentResult(success=False)
        horizon = int(self.ctx.inputs.get("horizon_months", 6))
        pred = await self.call_tool(
            "model.predict",
            {"model": "cash_forecast_v3", "horizon_months": horizon},
        )
        result.tool_calls.append(pred)
        result.success = pred.error is None
        result.output = pred.result or {}
        result.summary = f"{horizon}-month cash forecast generated"
        return result
