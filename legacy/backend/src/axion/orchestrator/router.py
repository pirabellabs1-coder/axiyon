"""Multi-agent router — picks the next agent for a handoff."""
from __future__ import annotations

from axion.agents.catalog import CATALOG


def route_handoff(target: str) -> str | None:
    """Resolve a handoff target string to a known template slug.

    Accepts: a slug ('cfo-assistant'), an agent name ('Atlas'), or a role ('CFO').
    """
    target_lc = target.lower().strip()

    # Direct slug match
    if target_lc in CATALOG:
        return target_lc

    # Name match
    for slug, t in CATALOG.items():
        if t.name.lower() == target_lc:
            return slug

    # Role keyword match
    for slug, t in CATALOG.items():
        if target_lc in t.role.lower():
            return slug

    return None
