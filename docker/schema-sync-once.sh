#!/usr/bin/env bash
# Create/update TypeORM tables on Postgres (bypasses PgBouncer — DDL needs direct PG).
#
# Why not via the running api service:
#   DATABASE_URL points at pgbouncer; TypeORM synchronize / ALTER TYPE often fails there
#   and can abort Nest bootstrap (container Restarting).
#
# Usage:
#   bash docker/schema-sync-once.sh
#   DRACORD_SCHEMA_SKIP_RECREATE=1 bash docker/schema-sync-once.sh   # sync only (deploy rolls later)
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

echo "==> One-shot API boot: synchronize=true + direct postgres (not pgbouncer)"
# run blocks until we stop it; timeout after sync window
# Not: docker compose run --no-build desteklemez (eski compose flag)
set +e
timeout 60 "${COMPOSE[@]}" run --rm --no-deps \
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

# Ensure channel type enum values exist (TypeORM sync often skips enum widen)
"${COMPOSE[@]}" exec -T postgres \
  psql -U "$PGUSER" -d "$PGDB" -v ON_ERROR_STOP=0 <<'SQL' || true
DO $enum$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channels_type_enum') THEN
    IF NOT EXISTS (
       SELECT 1 FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'channels_type_enum' AND e.enumlabel = 'FORUM'
     ) THEN
      ALTER TYPE channels_type_enum ADD VALUE 'FORUM';
    END IF;
    IF NOT EXISTS (
       SELECT 1 FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'channels_type_enum' AND e.enumlabel = 'GAME'
     ) THEN
      ALTER TYPE channels_type_enum ADD VALUE 'GAME';
    END IF;
    IF NOT EXISTS (
       SELECT 1 FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'channels_type_enum' AND e.enumlabel = 'WATCH_PARTY'
     ) THEN
      ALTER TYPE channels_type_enum ADD VALUE 'WATCH_PARTY';
    END IF;
  END IF;
END
$enum$;
SQL

if [[ "${DRACORD_SCHEMA_SKIP_RECREATE:-0}" == "1" ]]; then
  echo "==> Schema sync done (skip recreate — caller will roll api)"
  exit 0
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
