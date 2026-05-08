"""Agents resource."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from axion.client import Axion


class AgentsResource:
    def __init__(self, client: "Axion") -> None:
        self._c = client

    # ── Catalog ───────────────────────────────────────────────

    def catalog(self, *, category: str | None = None, q: str | None = None) -> list[dict]:
        params = {k: v for k, v in {"category": category, "q": q}.items() if v}
        return self._c._request("GET", "/agents/catalog", params=params)

    def template(self, slug: str) -> dict:
        return self._c._request("GET", f"/agents/catalog/{slug}")

    # ── Instances ────────────────────────────────────────────

    def list(self, *, status: str | None = None) -> list[dict]:
        params = {"status": status} if status else {}
        return self._c._request("GET", "/agents", params=params)

    def get(self, agent_id: str) -> dict:
        return self._c._request("GET", f"/agents/{agent_id}")

    def hire(
        self,
        *,
        template: str,
        name: str,
        config: dict[str, Any] | None = None,
        enabled_tools: list[str] | None = None,
        custom_prompt: str | None = None,
        voice_clone_id: str | None = None,
        budget_per_day: int = 100,
    ) -> dict:
        body = {
            "template_slug": template,
            "name": name,
            "config": config or {},
            "enabled_tools": enabled_tools or [],
            "custom_prompt": custom_prompt,
            "voice_clone_id": voice_clone_id,
            "budget_per_day_eur": budget_per_day,
        }
        return self._c._request("POST", "/agents", json=body)

    def update(self, agent_id: str, **fields: Any) -> dict:
        return self._c._request("PATCH", f"/agents/{agent_id}", json=fields)

    def delete(self, agent_id: str) -> None:
        self._c._request("DELETE", f"/agents/{agent_id}")

    def pause(self, agent_id: str) -> None:
        self._c._request("POST", f"/agents/{agent_id}/pause")

    def resume(self, agent_id: str) -> None:
        self._c._request("POST", f"/agents/{agent_id}/resume")

    def run(
        self,
        agent_id: str,
        *,
        objective: str,
        inputs: dict[str, Any] | None = None,
        timeout_s: int = 300,
    ) -> dict:
        """Trigger an ad-hoc run. Returns the Task object."""
        return self._c._request(
            "POST",
            f"/agents/{agent_id}/run",
            json={
                "objective": objective,
                "inputs": inputs or {},
                "timeout_s": timeout_s,
            },
        )
