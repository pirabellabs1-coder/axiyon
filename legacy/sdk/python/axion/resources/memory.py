"""Memory resource."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from axion.client import Axion


class MemoryResource:
    def __init__(self, client: "Axion") -> None:
        self._c = client

    def ingest(
        self,
        content: str,
        *,
        kind: str = "semantic",
        importance: float = 0.5,
        source: str | None = None,
        metadata: dict[str, Any] | None = None,
        agent_id: str | None = None,
    ) -> dict:
        return self._c._request(
            "POST",
            "/memory/ingest",
            json={
                "content": content,
                "kind": kind,
                "importance": importance,
                "source": source,
                "metadata": metadata or {},
                "agent_id": agent_id,
            },
        )

    def recall(
        self,
        query: str,
        *,
        k: int = 8,
        kind: str | None = None,
        min_importance: float = 0.0,
    ) -> list[dict]:
        return self._c._request(
            "POST",
            "/memory/recall",
            json={
                "query": query,
                "k": k,
                "kind": kind,
                "min_importance": min_importance,
            },
        )

    def export(self, *, kind: str | None = None, limit: int = 10000) -> list[dict]:
        params: dict[str, Any] = {"limit": limit}
        if kind:
            params["kind"] = kind
        return self._c._request("GET", "/memory/export", params=params)
