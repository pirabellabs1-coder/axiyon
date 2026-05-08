# Contributing to Axion

Thank you for considering a contribution. This document describes how to propose changes, run the dev environment, and what we expect from PRs.

## Code of Conduct

Be kind, be precise, be honest. Personal attacks and disrespectful behaviour will result in immediate removal from the community. Disagreement on technical merit is encouraged. Disagreement on attitude is not.

## How to contribute

### Bug reports

1. Check open issues — has someone reported it already?
2. Open an issue with: a clear title, a minimal reproduction, the expected vs. actual behaviour, your environment (OS, Python version, Axion version).
3. If you're a paying customer, also email `support@axion.ai` for SLA-tracked support.

### Feature requests

We don't ship every requested feature. Quality > quantity. If you have an idea:

1. Open a Discussion (not an Issue) on GitHub.
2. Explain the use case and what problem it solves — not the proposed solution.
3. We'll engage if it aligns with the roadmap.

### Pull requests

1. **Fork** the repo and **branch off `main`**.
2. **Sign the CLA** (one-time, online).
3. **Run tests + lint locally** before pushing.
4. Open a PR against `main` with a clear description and a link to the issue / discussion.
5. PRs must pass: CI green, 1 reviewer approval, and a passing security scan.

### Conventions

- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- **Branches**: `feat/short-description`, `fix/short-description`, `docs/...`.
- **Code style**: ruff for Python, eslint for TS. Auto-format with `ruff format` / `prettier`.
- **Type-checking**: mypy strict for Python, tsc strict for TS.
- **Tests**: every new feature ships with tests. Coverage must not regress.
- **Documentation**: every public API change needs a doc update in the same PR.

## Dev setup

```bash
git clone https://github.com/axion-labs/axion
cd axion

# 1) Spin up infrastructure
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis

# 2) Backend
cd backend
cp .env.example .env
pip install -e ".[dev]"
alembic upgrade head
pytest -q
axion-api  # http://localhost:8000

# 3) SDKs (in separate shells)
cd sdk/python && pip install -e ".[dev]" && pytest
cd sdk/typescript && npm install && npm test

# 4) CLI
cd cli && pip install -e .
axion --help
```

## Areas where we'd love help

- Tool integrations (HubSpot, Notion, Jira deeper, etc.)
- Verticals (healthcare, public sector, retail)
- SDKs in more languages (Go, Rust, Java)
- Translations (manifesto, docs) into more languages
- Examples / tutorials / cookbook recipes

## What we won't accept

- Code that lowers test coverage
- Code without types
- Features that violate the manifesto principles (especially principle VII)
- "Drive-by" PRs that touch many unrelated areas

## License

By submitting code, you agree that your contribution will be licensed under the same terms as the rest of the project (see [LICENSE](./LICENSE)).
