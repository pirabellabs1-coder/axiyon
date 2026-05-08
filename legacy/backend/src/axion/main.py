"""FastAPI application factory + entrypoint."""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, ORJSONResponse
from prometheus_client import Counter, Histogram, generate_latest

from axion.api import api_router
from axion.config import get_settings


def _configure_logging(level: str) -> None:
    logging.basicConfig(format="%(message)s", level=level)
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, level)),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    _configure_logging(settings.log_level)
    log = structlog.get_logger("axion")
    log.info(
        "axion_startup",
        env=settings.env,
        region=settings.region,
        prefix=settings.api_prefix,
    )
    # Pre-warm tool & agent registries
    from axion.agents.registry import get_registry as _gar
    from axion.tools.registry import ToolRegistry as _TR

    _gar()
    _TR()
    yield
    log.info("axion_shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Axion API",
        version="1.0.0",
        description=(
            "Axion — The Operating System for the Autonomous Enterprise.\n\n"
            "Hire, orchestrate, and govern AI employees via a single API."
        ),
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
        openapi_url=f"{settings.api_prefix}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-Id", "X-Trace-Id"],
    )

    # ── Metrics ───────────────────────────────────────────────
    REQUESTS = Counter(
        "axion_http_requests_total",
        "Total HTTP requests",
        ["method", "path", "status"],
    )
    LATENCY = Histogram(
        "axion_http_request_duration_seconds",
        "Request latency",
        ["method", "path"],
    )

    @app.middleware("http")
    async def metrics_and_logging(request: Request, call_next: Any):
        start = time.perf_counter()
        request_id = request.headers.get("x-request-id") or _gen_request_id()
        try:
            response = await call_next(request)
        except Exception as e:  # noqa: BLE001
            structlog.get_logger("axion").exception(
                "request_failed", method=request.method, path=request.url.path
            )
            response = JSONResponse(
                {"detail": "Internal Server Error", "request_id": request_id},
                status_code=500,
            )
        duration = time.perf_counter() - start
        path = request.url.path
        REQUESTS.labels(request.method, path, str(response.status_code)).inc()
        LATENCY.labels(request.method, path).observe(duration)
        response.headers["X-Request-Id"] = request_id
        response.headers["X-Response-Time-Ms"] = f"{duration*1000:.1f}"
        return response

    @app.get("/health", tags=["meta"])
    async def health() -> dict:
        return {"status": "ok", "version": "1.0.0", "env": settings.env}

    @app.get("/ready", tags=["meta"])
    async def ready() -> dict:
        # In real life: ping db + redis here
        return {"status": "ready"}

    @app.get("/metrics", tags=["meta"], include_in_schema=False)
    async def metrics() -> Any:
        from fastapi.responses import Response
        return Response(generate_latest(), media_type="text/plain; version=0.0.4")

    app.include_router(api_router, prefix=settings.api_prefix)

    return app


def _gen_request_id() -> str:
    import uuid as _uuid
    return _uuid.uuid4().hex


app = create_app()


def run() -> None:
    """Console entrypoint: `axion-api`."""
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "axion.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
        access_log=False,
    )


if __name__ == "__main__":
    run()
