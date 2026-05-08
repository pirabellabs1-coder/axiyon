"""API routers."""
from fastapi import APIRouter

from axion.api.v1 import (
    agents,
    audit,
    auth,
    billing,
    integrations,
    memory,
    orgs,
    tasks,
    webhooks,
    workflows,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(orgs.router, prefix="/orgs", tags=["orgs"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["workflows"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(memory.router, prefix="/memory", tags=["memory"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])

__all__ = ["api_router"]
