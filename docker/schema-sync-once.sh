#!/usr/bin/env bash
# One-shot TypeORM schema sync for empty prod DB (creates accounts/users/…).
# Usage on server:
#   bash docker/schema-sync-once.sh
# After success, remove DATABASE_SYNCHRONIZE from .env (script does this).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

COMPOSE=(docker compose
  -f docker/docker-compose.yml
  -f docker/docker-compose.zd.yml
  -f docker/docker-compose.prod.yml
  --env-file "$ENV_FILE"
)

echo "==> Enable DATABASE_SYNCHRONIZE=true (temporary)"
if grep -q '^DATABASE_SYNCHRONIZE=' "$ENV_FILE"; then
  sed -i.bak 's/^DATABASE_SYNCHRONIZE=.*/DATABASE_SYNCHRONIZE=true/' "$ENV_FILE"
else
  printf '\nDATABASE_SYNCHRONIZE=true\n' >> "$ENV_FILE"
fi

REPLICAS="${DRACORD_REPLICAS:-2}"
echo "==> Recreate api (schema sync on boot)"
"${COMPOSE[@]}" up -d --no-deps --force-recreate --scale "api=$REPLICAS" api

echo "==> Wait for healthy"
for _ in $(seq 1 60); do
  h="$("${COMPOSE[@]}" ps api 2>/dev/null | grep -c '(healthy)' || true)"
  if [[ "${h:-0}" -ge 1 ]]; then
    break
  fi
  sleep 2
done

echo "==> Verify accounts table"
"${COMPOSE[@]}" exec -T postgres \
  psql -U "${POSTGRES_USER:-dracord}" -d "${POSTGRES_DB:-dracord}" \
  -c '\dt accounts' || \
"${COMPOSE[@]}" exec -T postgres \
  psql -U postgres -d dracord -c '\dt accounts' || true

echo "==> Disable DATABASE_SYNCHRONIZE"
sed -i.bak 's/^DATABASE_SYNCHRONIZE=.*/DATABASE_SYNCHRONIZE=false/' "$ENV_FILE"
"${COMPOSE[@]}" up -d --no-deps --force-recreate --scale "api=$REPLICAS" api

echo "Done. Google login should work now."
