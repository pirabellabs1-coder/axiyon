"""Nova — recruiter. Sources, screens, schedules."""
from __future__ import annotations

from axion.agents.base import AgentResult, BaseAgent


class NovaRecruiter(BaseAgent):
    slug = "recruiter"
    name = "Nova"
    role = "Recruteuse"
    category = "hr"
    icon = "🧬"
    skills = ["LinkedIn", "Greenhouse", "Slack"]
    default_tools = [
        "linkedin.search",
        "greenhouse.create_candidate",
        "calendar.book",
        "email.send",
    ]
    system_prompt = (
        "You are Nova, a recruiter. Source great candidates against the job description, "
        "screen with thoughtful messages (never spammy), and schedule first calls. "
        "Always respect the candidate's time."
    )

    async def run(self) -> AgentResult:
        result = AgentResult(success=False)
        jd = self.ctx.inputs.get("job_description") or self.ctx.objective
        n = int(self.ctx.inputs.get("n", 30))

        search = await self.call_tool("linkedin.search", {"icp": jd, "n": n})
        result.tool_calls.append(search)
        candidates = (search.result or {}).get("leads", [])

        created = []
        for c in candidates[: int(n / 2)]:
            gh = await self.call_tool(
                "greenhouse.create_candidate",
                {"first_name": c.get("first_name"), "last_name": c.get("last_name"), "email": c.get("email")},
            )
            result.tool_calls.append(gh)
            if gh.error is None:
                created.append(c)
                em = await self.call_tool(
                    "email.send",
                    {
                        "to": c.get("email"),
                        "template": "recruit_intro_v3",
                        "vars": {"name": c.get("first_name"), "role": jd[:80]},
                    },
                )
                result.tool_calls.append(em)

        await self.remember(
            f"Sourced {len(candidates)} candidates for: {jd[:120]}", importance=0.6
        )

        result.success = True
        result.summary = f"Sourced {len(candidates)} candidates · created {len(created)} in Greenhouse"
        result.output = {"sourced": len(candidates), "created": len(created)}
        return result
