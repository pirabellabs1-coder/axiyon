"""Workflows resource."""
from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any

from axion.errors import AxionError

if TYPE_CHECKING:
    from axion.client import Axion


class WorkflowsResource:
    def __init__(self, client: "Axion") -> None:
        self._c = client

    def list(self, *, status: str | None = None) -> list[dict]:
        params = {"status": status} if status else {}
        return self._c._request("GET", "/workflows", params=params)

    def get(self, slug: str, *, version: int | None = None) -> dict:
        params = {"version": version} if version else {}
        return self._c._request("GET", f"/workflows/{slug}", params=params)

    def create(self, slug: str, spec: dict[str, Any]) -> dict:
        return self._c._request("POST", "/workflows", json={"slug": slug, "spec": spec})

    def publish(self, slug: str, *, version: int | None = None) -> dict:
        params = {"version": version} if version else {}
        return self._c._request("POST", f"/workflows/{slug}/publish", params=params)

    def run(self, slug: str, *, inputs: dict[str, Any] | None = None) -> dict:
        return self._c._request(
            "POST", f"/workflows/{slug}/run", json={"inputs": inputs or {}}
        )

    def get_run(self, run_id: str) -> dict:
        return self._c._request("GET", f"/workflows/runs/{run_id}")

    def get_run_steps(self, run_id: str) -> list[dict]:
        return self._c._request("GET", f"/workflows/runs/{run_id}/steps")

    def cancel_run(self, run_id: str) -> None:
        self._c._request("POST", f"/workflows/runs/{run_id}/cancel")

    def replay_run(self, run_id: str) -> dict:
        return self._c._request("POST", f"/workflows/runs/{run_id}/replay")

    def wait_for_run(
        self,
        run_id: str,
        *,
        poll_interval_s: float = 2.0,
        timeout_s: float = 600.0,
    ) -> dict:
        """Block until the run reaches a terminal state."""
        deadline = time.time() + timeout_s
        terminal = {"succeeded", "failed", "cancelled"}
        while time.time() < deadline:
            run = self.get_run(run_id)
            if run["status"] in terminal:
                return run
            if run["status"] == "awaiting_approval":
                return run  # caller decides
            time.sleep(poll_interval_s)
        raise AxionError(f"Run {run_id} did not finish within {timeout_s}s")
