"""Axion — official Python SDK.

Quick start:

    from axion import Axion, Workflow

    ax = Axion(api_key="axn_live_...")
    iris = ax.agents.hire(template="sdr-outbound", name="Iris",
                          config={"icp": "VP Data, Series B+, Europe"},
                          budget_per_day=500)

    flow = (Workflow("deal-flow")
        .step("source", agent=iris.id, action="source_leads", params={"n": 100})
        .step("qualify", agent="cfo-assistant", action="qualify_margin",
              params={"margin_threshold_eur": 80_000}, depends_on=["source"])
        .step("book", agent=iris.id, action="book_demos", depends_on=["qualify"])
        .on_blocker(escalate_to="founder@helia.io"))

    ax.workflows.create("deal-flow", flow.spec)
    ax.workflows.publish("deal-flow")
    run = ax.workflows.run("deal-flow", inputs={"target": 50})
    print(run.status, run.outputs)
"""
from axion.client import Axion
from axion.workflow import Workflow

__version__ = "1.0.0"
__all__ = ["Axion", "Workflow", "__version__"]
