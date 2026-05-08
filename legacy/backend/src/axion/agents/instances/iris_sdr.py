"""Iris — outbound SDR. Sources leads, qualifies, books demos."""
from __future__ import annotations

from axion.agents.base import AgentResult, BaseAgent


class IrisSDR(BaseAgent):
    slug = "sdr-outbound"
    name = "Iris"
    role = "SDR Outbound"
    category = "sales"
    icon = "📞"
    skills = ["LinkedIn", "Email", "Voice", "Apollo", "Salesforce"]
    default_tools = [
        "linkedin.search",
        "apollo.enrich",
        "email.send",
        "calendar.book",
        "salesforce.update",
    ]
    system_prompt = (
        "You are Iris, a senior outbound SDR. You write personalized, non-spammy outreach. "
        "You qualify leads against the configured ICP and hand off to Atlas (CFO) for "
        "margin qualification on deals over the threshold. You only book demos with leads "
        "that pass qualification. Always include a clear, brief subject line and CTA."
    )

    async def run(self) -> AgentResult:
        result = AgentResult(success=False)
        cfg = self.ctx.config
        icp = cfg.get("icp", self.ctx.inputs.get("icp", "")) or self.ctx.objective
        target_count = int(cfg.get("target_count", self.ctx.inputs.get("n", 50)))
        margin_threshold = cfg.get("margin_threshold_eur", 80_000)

        # 1) Source leads
        search = await self.call_tool(
            "linkedin.search", {"icp": icp, "n": min(target_count * 3, 500)}
        )
        result.tool_calls.append(search)
        if search.error:
            result.error = f"linkedin.search failed: {search.error}"
            return result

        leads = (search.result or {}).get("leads", [])

        # 2) Enrich
        enrich = await self.call_tool(
            "apollo.enrich",
            {"leads": [l["id"] for l in leads]},
        )
        result.tool_calls.append(enrich)
        enriched = (enrich.result or {}).get("leads", leads)

        # 3) Hand off margin qualification to Atlas if threshold set
        if margin_threshold:
            return self.handoff(
                "cfo-assistant",
                summary=f"Qualify margin >= {margin_threshold}€ on {len(enriched)} leads",
                output={
                    "leads": enriched,
                    "margin_threshold_eur": margin_threshold,
                    "next_action": "iris.book_demo",
                    "target_count": target_count,
                },
            )

        # 4) Otherwise, book demos directly
        booked = []
        for lead in enriched[:target_count]:
            email = await self.call_tool(
                "email.send",
                {
                    "to": lead.get("email"),
                    "template": "sdr_outreach_v7",
                    "vars": {"name": lead.get("first_name"), "company": lead.get("company")},
                },
            )
            result.tool_calls.append(email)
            if email.error is None and (email.result or {}).get("replied"):
                book = await self.call_tool(
                    "calendar.book",
                    {"with": lead.get("email"), "duration_min": 30},
                )
                result.tool_calls.append(book)
                if book.error is None:
                    booked.append(lead)

        await self.remember(
            f"Sourced {len(enriched)} leads, booked {len(booked)} demos for ICP: {icp}",
            importance=0.7,
        )

        result.success = True
        result.summary = f"Sourced {len(enriched)} leads. Booked {len(booked)} demos."
        result.output = {
            "sourced": len(enriched),
            "booked": len(booked),
            "demos": [l.get("email") for l in booked],
        }
        return result
