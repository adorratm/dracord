#!/usr/bin/env bash
# Remote entrypoint for GitHub Actions → Hetzner.
# Secrets live only in server .env (never in the public git tree).
set -euo pipefail

DEPLOY_PATH="${DRACORD_DEPLOY_PATH:-/opt/dracord}"
BRANCH="${DRACORD_DEPLOY_BRANCH:-main}"
REPLICAS="${DRACORD_REPLICAS:-2}"

cd "$DEPLOY_PATH"

if [[ ! -f .env ]]; then
  echo "Missing $DEPLOY_PATH/.env — create it on the server; never commit .env." >&2
  exit 1
fi

# Soft-fail if .env still looks like the public example
if grep -qE 'JWT_ACCESS_SECRET=change-me|LIVEKIT_API_SECRET=secret_dracord_livekit_dev' .env; then
  echo "Production .env still contains example secrets — refuse to deploy." >&2
  exit 1
fi

if [[ "${DRACORD_SKIP_GIT:-0}" != "1" ]]; then
  echo "==> Sync $DEPLOY_PATH (branch=$BRANCH)"
  git fetch --prune origin
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
  # Never git clean — would risk deleting untracked .env / livekit.prod.yaml
fi

export DRACORD_COMPOSE_PROD=1
export DRACORD_REPLICAS="$REPLICAS"
export DRACORD_ROLL_MUSIC_BOT="${DRACORD_ROLL_MUSIC_BOT:-1}"

echo "==> Generate LiveKit prod config from .env"
bash docker/generate-livekit-prod.sh .env

echo "==> Ensure data plane"
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.zd.yml \
  -f docker/docker-compose.prod.yml \
  --env-file .env \
  up -d postgres pgbouncer redis elasticsearch livekit minio

bash docker/rolling-deploy.sh api web admin

docker image prune -f >/dev/null || true

echo "==> Smoke (local loopback)"
curl -fsS -o /dev/null -w "web %{http_code}\n" http://127.0.0.1:13000/health || true
curl -fsS -o /dev/null -w "api %{http_code}\n" http://127.0.0.1:14000/health/ready || true

echo "==> Deploy finished"
