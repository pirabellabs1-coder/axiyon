# syntax=docker/dockerfile:1.7
# Axion backend — multi-stage production image

ARG PYTHON_VERSION=3.11

# ─── Builder ────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY pyproject.toml ./
COPY src ./src

RUN pip install --upgrade pip wheel && \
    pip install --prefix=/install ".[dev]"

# ─── Runtime ────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/usr/local/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 curl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1000 axion && useradd -u 1000 -g 1000 -m -s /bin/bash axion

COPY --from=builder /install /usr/local
COPY --chown=axion:axion src /app/src
COPY --chown=axion:axion alembic /app/alembic
COPY --chown=axion:axion alembic.ini /app/alembic.ini
COPY --chown=axion:axion pyproject.toml /app/pyproject.toml

WORKDIR /app
USER axion

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:8000/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "axion.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
