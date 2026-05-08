# Deployment — Axion

How to deploy Axion in your own environment. Three modes:

| Mode | When | Effort |
|---|---|---|
| **SaaS** (default) | You're a customer using `app.axion.ai` | Zero. Sign up. |
| **VPC** | Enterprise, regulated, want isolation | ~ 1 day with our SE team |
| **On-prem** | Banking, public sector, fully airgapped | ~ 3 days with our SE team |

This document covers VPC and on-prem.

---

## Option A — Local development

```bash
git clone https://github.com/axion-labs/axion
cd axion

# Spin up Postgres + Redis + API + worker locally
docker compose -f infrastructure/docker/docker-compose.yml up

# In another shell:
cd backend
cp .env.example .env
pip install -e ".[dev]"
alembic upgrade head
axion-api      # API on http://localhost:8000
axion-worker   # Celery worker

# In a third shell:
pip install ./sdk/python ./cli
axion auth login   # paste a key (or use stub mode without one)
```

Without LLM API keys, the `NullProvider` returns deterministic mock data so the entire stack runs end-to-end offline.

---

## Option B — Kubernetes (Helm)

### Prerequisites

- Kubernetes 1.29+
- An ingress controller (nginx tested)
- cert-manager + a ClusterIssuer (`letsencrypt-prod` recommended)
- Postgres 16 with pgvector extension (RDS or self-hosted)
- Redis 7+ (ElastiCache or self-hosted)
- An S3-compatible bucket for audit storage
- KMS or equivalent for envelope encryption

### Install

```bash
helm repo add axion https://charts.axion.ai
helm repo update

# Create the namespace + secret
kubectl create namespace axion
kubectl -n axion create secret generic axion-jwt \
  --from-literal=jwt-secret="$(openssl rand -hex 32)"
kubectl -n axion create secret generic axion-llm \
  --from-literal=anthropic="$ANTHROPIC_API_KEY" \
  --from-literal=openai="$OPENAI_API_KEY" \
  --from-literal=mistral="$MISTRAL_API_KEY"
# … repeat for axion-stripe, axion-encryption-key, axion-db-secret

helm install axion axion/axion \
  --namespace axion \
  -f my-values.yaml \
  --wait --timeout 8m

# Run database migrations (one-shot Job)
kubectl -n axion run --rm -it migrate \
  --image=ghcr.io/axion-labs/axion-api:1.0.0 \
  --restart=Never --command -- alembic upgrade head
```

`my-values.yaml` minimal example:

```yaml
global:
  imageTag: "1.0.0"
  region: eu-west-3
  env: production

api:
  replicas: 4
  ingress:
    enabled: true
    hosts:
      - host: api.your-domain.com
        paths:
          - { path: /, pathType: Prefix }
    tls:
      - { secretName: axion-tls, hosts: [api.your-domain.com] }

postgres:
  external:
    host: your-rds.eu-west-3.rds.amazonaws.com
    secretName: axion-db-secret

redis:
  external:
    url: redis://your-redis.cache.amazonaws.com:6379
```

### Upgrade

```bash
helm upgrade axion axion/axion -f my-values.yaml --wait
```

### Rollback

```bash
helm rollback axion 0  # previous revision
```

---

## Option C — On-prem (airgapped)

```bash
# 1. Pull images on a connected machine
for img in axion-api axion-worker; do
  docker pull ghcr.io/axion-labs/$img:1.0.0
  docker save ghcr.io/axion-labs/$img:1.0.0 -o $img.tar
done

# 2. Transfer image bundle to the airgapped network
scp *.tar ops-bastion:/tmp/

# 3. Push to your registry
for img in axion-api axion-worker; do
  docker load -i $img.tar
  docker tag ghcr.io/axion-labs/$img:1.0.0 internal-registry.corp/axion/$img:1.0.0
  docker push internal-registry.corp/axion/$img:1.0.0
done

# 4. Deploy (override registry in values.yaml)
helm install axion ./helm \
  --namespace axion \
  --set global.image.registry=internal-registry.corp/axion \
  -f values.onprem.yaml
```

### License heartbeat

By default the platform pings `license.axion.ai` once per hour with anonymized usage stats (no customer data). You can:

1. **Allow** the heartbeat through your egress proxy (recommended).
2. **Disable** it with `--set license.heartbeat.enabled=false` and rotate signed offline license tokens monthly.

---

## Option D — AWS (Terraform)

Production-grade reference stack:

```bash
cd infrastructure/terraform
terraform init
terraform plan -var-file=production.tfvars -out=plan
terraform apply plan
```

Provisions: VPC + EKS + RDS + ElastiCache + S3 audit bucket + KMS + IAM (IRSA). Outputs include the `IRSA role ARN` you wire into the `serviceAccount.annotations` of the Helm chart.

---

## Sizing

| Tier | API replicas | Worker replicas | RDS | Redis | Notes |
|---|---|---|---|---|---|
| **POC / dev** | 1 | 1 | db.t4g.medium | cache.t4g.small | $0 if reused |
| **Small (≤ 100 customers)** | 2 | 4 | db.r7g.large | cache.r7g.medium | ~$1.5k/mo |
| **Medium (≤ 1k)** | 4 | 8-16 | db.r7g.xlarge | cache.r7g.large | ~$5k/mo |
| **Large (≤ 5k)** | 8-20 | 32-80 | db.r7g.2xlarge | cache.r7g.xlarge | ~$18k/mo |
| **Enterprise / dedicated** | 4-12 | 16-40 | db.r7g.xlarge | cache.r7g.large | per-tenant cluster |

## Operations runbook

- **Restart API**: `kubectl -n axion rollout restart deploy/axion-api`
- **Drain a worker** (graceful): `kubectl -n axion exec axion-worker-xxx -- celery -A axion.workers.celery_app:celery_app inspect active` then scale down replicas.
- **Run a one-off task**: `kubectl -n axion run --rm -it task --image=ghcr.io/axion-labs/axion-api:1.0.0 --command -- python -m axion.scripts.thing`
- **Tail logs**: `kubectl -n axion logs -f -l component=api --max-log-requests=10`
- **Postgres slow query**: `kubectl -n axion exec deploy/axion-api -- alembic current` then connect via bastion.
- **Verify audit chain**: `curl -X POST -H "Authorization: Bearer $T" https://api.your-domain/v1/audit/verify`
