"""Top-level Axion client. Lazy-instantiates resource sub-clients."""
from __future__ import annotations

import os
from typing import Any

import httpx

from axion.errors import AuthError, AxionError, ConflictError, NotFoundError, RateLimited, ServerError, ValidationError
from axion.resources.agents import AgentsResource
from axion.resources.audit import AuditResource
from axion.resources.memory import MemoryResource
from axion.resources.tasks import TasksResource
from axion.resources.workflows import WorkflowsResource

DEFAULT_BASE_URL = "https://api.axion.ai/v1"


class Axion:
    """Synchronous + async-friendly client.

    Args:
        api_key: starts with `axn_live_` or `axn_test_`. Falls back to `AXION_API_KEY` env.
        base_url: override for self-hosted / VPC deployments.
        org_id: required for multi-org accounts. Falls back to `AXION_ORG_ID` env.
        timeout: per-request timeout in seconds.
    """

    def __init__(
        self,
        api_key: str | None = None,
        *,
        base_url: str | None = None,
        org_id: str | None = None,
        timeout: float = 30.0,
        user_agent: str | None = None,
    ) -> None:
        self.api_key = api_key or os.environ.get("AXION_API_KEY")
        if not self.api_key:
            raise AuthError("Missing API key. Pass `api_key=...` or set AXION_API_KEY.")
        self.base_url = (base_url or os.environ.get("AXION_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.org_id = org_id or os.environ.get("AXION_ORG_ID")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "User-Agent": user_agent or "axion-python/1.0.0",
            "Accept": "application/json",
        }
        if self.org_id:
            headers["X-Org-Id"] = self.org_id

        self._client = httpx.Client(base_url=self.base_url, timeout=timeout, headers=headers)
        self._aclient: httpx.AsyncClient | None = None

        # Resource sub-clients
        self.agents = AgentsResource(self)
        self.workflows = WorkflowsResource(self)
        self.tasks = TasksResource(self)
        self.memory = MemoryResource(self)
        self.audit = AuditResource(self)

    # ─── Lifecycle ────────────────────────────────────────────────

    def __enter__(self) -> "Axion":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()
        if self._aclient:
            import asyncio
            try:
                asyncio.get_event_loop().run_until_complete(self._aclient.aclose())
            except Exception:
                pass

    # ─── Internals ────────────────────────────────────────────────

    def _request(self, method: str, path: str, **kw: Any) -> Any:
        try:
            r = self._client.request(method, path, **kw)
        except httpx.TimeoutException as e:
            raise AxionError(f"Request timed out: {e}") from e
        except httpx.HTTPError as e:
            raise AxionError(f"Network error: {e}") from e
        return self._handle(r)

    @staticmethod
    def _handle(r: httpx.Response) -> Any:
        if r.status_code in (200, 201, 202):
            if r.headers.get("content-type", "").startswith("application/json"):
                return r.json()
            return r.text
        if r.status_code == 204:
            return None

        try:
            detail = r.json().get("detail", r.text)
        except Exception:
            detail = r.text

        if r.status_code == 401:
            raise AuthError(detail)
        if r.status_code == 403:
            raise AuthError(detail)
        if r.status_code == 404:
            raise NotFoundError(detail)
        if r.status_code == 409:
            raise ConflictError(detail)
        if r.status_code == 422:
            raise ValidationError(detail)
        if r.status_code == 429:
            raise RateLimited(detail)
        if 500 <= r.status_code < 600:
            raise ServerError(detail)
        raise AxionError(f"{r.status_code}: {detail}")

    # ─── Health ───────────────────────────────────────────────────

    def health(self) -> dict:
        """Returns {status, version, env}."""
        # Health endpoint is at root, not under /v1
        root = self.base_url.rsplit("/v1", 1)[0]
        with httpx.Client(base_url=root) as c:
            return c.get("/health").json()
