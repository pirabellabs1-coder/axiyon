.DEFAULT_GOAL := help
.PHONY: help install dev test lint format typecheck clean docker-up docker-down migrate seed sdk-python sdk-ts cli docs

help:
	@echo "Axion · developer Makefile"
	@echo ""
	@echo "  make install        Install backend + SDKs + CLI in editable mode"
	@echo "  make docker-up      Start postgres + redis + api + worker"
	@echo "  make docker-down    Stop them"
	@echo "  make migrate        Run alembic upgrade head"
	@echo "  make dev            Run the API locally (auto-reload)"
	@echo "  make test           Run all tests (backend + sdks)"
	@echo "  make lint           Lint everything"
	@echo "  make format         Format everything"
	@echo "  make typecheck      Type-check Python + TS"
	@echo "  make sdk-python     Build + install Python SDK"
	@echo "  make sdk-ts         Build TS SDK"
	@echo "  make cli            Install the axion CLI"
	@echo "  make docs           Build docs locally"
	@echo "  make clean          Remove build/cache artifacts"

install:
	pip install -e backend[dev]
	pip install -e sdk/python
	pip install -e cli
	cd sdk/typescript && npm install

docker-up:
	docker compose -f infrastructure/docker/docker-compose.yml up -d

docker-down:
	docker compose -f infrastructure/docker/docker-compose.yml down

migrate:
	cd backend && alembic upgrade head

dev:
	cd backend && DEBUG=true axion-api

test:
	cd backend && pytest -q
	cd sdk/typescript && npm test || true

lint:
	cd backend && ruff check src/ tests/
	cd sdk/typescript && npm run lint || true

format:
	cd backend && ruff format src/ tests/
	cd sdk/typescript && npx prettier -w src/ || true

typecheck:
	cd backend && mypy src/ || true
	cd sdk/typescript && npm run typecheck

sdk-python:
	cd sdk/python && python -m build && pip install dist/*.whl

sdk-ts:
	cd sdk/typescript && npm run build

cli:
	pip install -e cli
	axion --help

docs:
	@echo "Docs are markdown — open them in your editor or any markdown viewer."

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf backend/dist backend/build backend/*.egg-info
	rm -rf sdk/python/dist sdk/python/build
	rm -rf sdk/typescript/dist
