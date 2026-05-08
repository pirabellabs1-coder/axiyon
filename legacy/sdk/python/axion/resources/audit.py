"""Audit resource."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from axion.client import Axion


class AuditResource:
    def __init__(self, client: "Axion") -> None:
        self._c = client

    def list(
        self,
        *,
        actor_type: str | None = None,
        action: str | None = None,
        resource_type: str | None = None,
        since: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        for k, v in {
            "actor_type": actor_type,
            "action": action,
            "resource_type": resource_type,
            "since": since,
        }.items():
            if v:
                params[k] = v
        return self._c._request("GET", "/audit", params=params)

    def verify(self) -> dict:
        return self._c._request("POST", "/audit/verify")
