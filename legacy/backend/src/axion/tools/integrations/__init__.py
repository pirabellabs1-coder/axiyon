"""Concrete tool integrations.

Each module exposes a `register(registry)` function that adds one or more
ToolSpecs. In dev/no-key mode the integrations return realistic mock data
so agents can be tested end-to-end without external accounts.
"""
