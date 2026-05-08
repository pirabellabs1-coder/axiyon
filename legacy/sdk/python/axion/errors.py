"""Typed exceptions raised by the SDK."""
from __future__ import annotations


class AxionError(Exception):
    """Base class for all SDK errors."""


class AuthError(AxionError):
    """401 / 403 — invalid or missing credentials, or insufficient role."""


class NotFoundError(AxionError):
    """404 — resource not found."""


class ConflictError(AxionError):
    """409 — duplicate / unique constraint violation."""


class ValidationError(AxionError):
    """422 — request body failed validation."""


class RateLimited(AxionError):
    """429 — quota exceeded, back off."""


class ServerError(AxionError):
    """5xx — server-side problem; retry with backoff."""
