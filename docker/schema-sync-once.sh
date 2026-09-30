#!/usr/bin/env bash
# Create TypeORM tables on an empty prod Postgres (bypasses PgBouncer — DDL needs direct PG).
#
# Why .env NODE_ENV=development alone failed:
#   docker-compose.prod.yml used to force NODE_ENV=production on the api service,
#   and DATABASE_URL points at pgbouncer (schema sync/DDL often fails there).
#
# Usage:
#   bash docker/schema-sync-once.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

# Load secrets without printing
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

PGUSER="${POSTGRES_USER:-dracord}"
PGDB="${POSTGRES_DB:-dracord}"
PGPASS="${POSTGRES_PASSWORD:-dracord}"
DIRECT_URL="postgres://${PGUSER}:${PGPASS}@postgres:5432/${PGDB}"

COMPOSE=(docker compose
  -f docker/docker-compose.yml
  -f docker/docker-compose.zd.yml
  -f docker/docker-compose.prod.yml
  --env-file "$ENV_FILE"
)

echo "==> One-shot API boot: NODE_ENV=development + direct postgres (not pgbouncer)"
# run blocks until we stop it; timeout after sync window
set +e
timeout 45 "${COMPOSE[@]}" run --rm --no-deps \
  -e NODE_ENV=development \
  -e DATABASE_SYNCHRONIZE=true \
  -e DATABASE_URL="$DIRECT_URL" \
  api
rc=$?
set -e
echo "    run exit=$rc (124=timeout expected after sync)"

echo "==> Tables:"
"${COMPOSE[@]}" exec -T postgres \
  psql -U "$PGUSER" -d "$PGDB" -c '\dt' | head -50

if ! "${COMPOSE[@]}" exec -T postgres \
  psql -U "$PGUSER" -d "$PGDB" -tAc "SELECT to_regclass('public.accounts');" | grep -q accounts; then
  echo "!! accounts table still missing — check api logs above" >&2
  exit 1
fi

echo "==> Restore production api replicas"
# Ensure .env is production again
if grep -q '^NODE_ENV=' "$ENV_FILE"; then
  sed -i.bak 's/^NODE_ENV=.*/NODE_ENV=production/' "$ENV_FILE"
else
  echo 'NODE_ENV=production' >> "$ENV_FILE"
fi
if grep -q '^DATABASE_SYNCHRONIZE=' "$ENV_FILE"; then
  sed -i.bak 's/^DATABASE_SYNCHRONIZE=.*/DATABASE_SYNCHRONIZE=false/' "$ENV_FILE"
else
  echo 'DATABASE_SYNCHRONIZE=false' >> "$ENV_FILE"
fi

REPLICAS="${DRACORD_REPLICAS:-2}"
"${COMPOSE[@]}" up -d --no-deps --force-recreate --scale "api=$REPLICAS" api
echo "Done. Retry Google login."
