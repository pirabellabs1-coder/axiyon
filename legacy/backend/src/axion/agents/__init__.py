"""Agent system: catalog, base class, registry, instances."""
from axion.agents.base import AgentResult, BaseAgent, ToolCall
from axion.agents.catalog import CATALOG, get_template
from axion.agents.registry import get_registry

__all__ = [
    "AgentResult",
    "BaseAgent",
    "CATALOG",
    "ToolCall",
    "get_registry",
    "get_template",
]
