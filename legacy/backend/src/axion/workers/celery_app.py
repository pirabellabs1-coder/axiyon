"""Celery application + task entrypoints.

Used in production for async agent dispatch, scheduled workflows, and webhook fan-out.
In dev mode the API runs tasks in-process (asyncio.create_task) so Celery is optional.
"""
from __future__ import annotations

import asyncio
import uuid

from celery import Celery
from celery.schedules import crontab

from axion.config import get_settings

settings = get_settings()

celery_app = Celery(
    "axion",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["axion.workers.celery_app"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    broker_connection_retry_on_startup=True,
    task_default_queue="axion.default",
    task_routes={
        "axion.workers.run_task": {"queue": "axion.agents"},
        "axion.workers.run_workflow": {"queue": "axion.workflows"},
        "axion.workers.scheduled.*": {"queue": "axion.scheduled"},
    },
    beat_schedule={
        "rotate-daily-counters": {
            "task": "axion.workers.scheduled.rotate_daily_counters",
            "schedule": crontab(minute=5, hour=0),
        },
        "process-scheduled-workflows": {
            "task": "axion.workers.scheduled.process_scheduled_workflows",
            "schedule": crontab(minute="*"),
        },
        "compute-org-usage": {
            "task": "axion.workers.scheduled.compute_org_usage",
            "schedule": crontab(minute=0, hour="*/2"),
        },
    },
)


@celery_app.task(name="axion.workers.run_task", bind=True, max_retries=3)
def run_task(self, task_id: str) -> str:
    from axion.agents.registry import get_registry
    registry = get_registry()
    asyncio.run(registry.execute_task(uuid.UUID(task_id)))
    return task_id


@celery_app.task(name="axion.workers.run_workflow", bind=True, max_retries=3)
def run_workflow(self, run_id: str) -> str:
    from axion.orchestrator.engine import get_engine
    engine = get_engine()
    asyncio.run(engine.execute_run(uuid.UUID(run_id)))
    return run_id


# ── Scheduled jobs ───────────────────────────────────────────


@celery_app.task(name="axion.workers.scheduled.rotate_daily_counters")
def rotate_daily_counters() -> dict:
    """Reset per-agent `tasks_today` counter every day at 00:05 UTC."""
    from sqlalchemy import update
    from axion.db.session import async_session_maker
    from axion.models.agent import AgentInstance

    async def _do():
        async with async_session_maker() as session:
            await session.execute(update(AgentInstance).values(tasks_today=0))
            await session.commit()
        return {"ok": True}

    return asyncio.run(_do())


@celery_app.task(name="axion.workers.scheduled.process_scheduled_workflows")
def process_scheduled_workflows() -> dict:
    """Every minute: trigger workflows whose cron schedule matches now."""
    return {"ok": True, "note": "implementation: walk Workflow.schedule_cron and dispatch eligible runs"}


@celery_app.task(name="axion.workers.scheduled.compute_org_usage")
def compute_org_usage() -> dict:
    return {"ok": True}


def run() -> None:
    """Console entrypoint: `axion-worker`."""
    celery_app.worker_main(["worker", "-l", "INFO", "--concurrency=8"])


if __name__ == "__main__":
    run()
