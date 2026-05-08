"""Orchestrator unit tests."""
from __future__ import annotations

import pytest

from axion.orchestrator.engine import WorkflowEngine
from axion.schemas.workflow import WorkflowStepSpec


def _step(id_: str, depends: list[str] | None = None) -> WorkflowStepSpec:
    return WorkflowStepSpec(id=id_, agent="sdr-outbound", action="x", depends_on=depends or [])


def test_topo_sort_linear():
    s = [_step("a"), _step("b", ["a"]), _step("c", ["b"])]
    assert WorkflowEngine._topo_sort(s) == ["a", "b", "c"]


def test_topo_sort_diamond():
    s = [
        _step("a"),
        _step("b", ["a"]),
        _step("c", ["a"]),
        _step("d", ["b", "c"]),
    ]
    order = WorkflowEngine._topo_sort(s)
    assert order[0] == "a"
    assert order[-1] == "d"
    assert order.index("b") < order.index("d")
    assert order.index("c") < order.index("d")


def test_topo_sort_cycle_raises():
    s = [_step("a", ["b"]), _step("b", ["a"])]
    with pytest.raises(ValueError, match="cycle"):
        WorkflowEngine._topo_sort(s)
