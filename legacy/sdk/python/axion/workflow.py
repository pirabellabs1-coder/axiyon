"""Fluent workflow builder."""
from __future__ import annotations

from typing import Any


class Workflow:
    """Build a workflow spec with a fluent API.

        flow = (Workflow("deal-flow", description="Weekly outbound")
            .step("source", agent="sdr-outbound", action="source_leads", params={"n": 100})
            .step("qualify", agent="cfo-assistant", action="qualify_margin",
                  params={"margin_threshold_eur": 80_000}, depends_on=["source"])
            .step("book", agent="sdr-outbound", action="book_demos",
                  depends_on=["qualify"], requires_approval=True, approval_threshold_eur=50_000)
            .schedule("0 9 * * 1")
            .on_blocker(escalate_to="founder@helia.io")
            .max_cost(20.0))
    """

    def __init__(self, name: str, description: str | None = None) -> None:
        self._spec: dict[str, Any] = {
            "name": name,
            "description": description,
            "schedule_cron": None,
            "inputs_schema": {},
            "steps": [],
            "on_blocker": {},
            "max_cost_eur": None,
        }

    def step(
        self,
        id: str,
        *,
        agent: str,
        action: str,
        params: dict[str, Any] | None = None,
        depends_on: list[str] | None = None,
        timeout_s: int = 300,
        retry: int = 2,
        on_failure: str = "fail",
        requires_approval: bool = False,
        approval_threshold_eur: float | None = None,
    ) -> "Workflow":
        self._spec["steps"].append({
            "id": id,
            "agent": agent,
            "action": action,
            "params": params or {},
            "depends_on": depends_on or [],
            "timeout_s": timeout_s,
            "retry": retry,
            "on_failure": on_failure,
            "requires_approval": requires_approval,
            "approval_threshold_eur": approval_threshold_eur,
        })
        return self

    def schedule(self, cron: str) -> "Workflow":
        self._spec["schedule_cron"] = cron
        return self

    def inputs(self, schema: dict[str, Any]) -> "Workflow":
        self._spec["inputs_schema"] = schema
        return self

    def on_blocker(self, *, escalate_to: str) -> "Workflow":
        self._spec["on_blocker"] = {"escalate_to": escalate_to}
        return self

    def max_cost(self, eur: float) -> "Workflow":
        self._spec["max_cost_eur"] = eur
        return self

    @property
    def spec(self) -> dict[str, Any]:
        return self._spec

    def to_dict(self) -> dict[str, Any]:
        return self._spec
