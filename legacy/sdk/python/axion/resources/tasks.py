"""Tasks resource."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from axion.client import Axion


class TasksResource:
    def __init__(self, client: "Axion") -> None:
        self._c = client

    def list(
        self,
        *,
        status: str | None = None,
        agent_id: str | None = None,
        workflow_run_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict]:
        params = {
            k: v
            for k, v in {
                "status": status,
                "agent_id": agent_id,
                "workflow_run_id": workflow_run_id,
                "limit": limit,
                "offset": offset,
            }.items()
            if v is not None
        }
        return self._c._request("GET", "/tasks", params=params)

    def get(self, task_id: str) -> dict:
        return self._c._request("GET", f"/tasks/{task_id}")

    def cancel(self, task_id: str) -> None:
        self._c._request("POST", f"/tasks/{task_id}/cancel")
