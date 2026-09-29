#!/usr/bin/env bash
# Zero-downtime rolling deploy for api/web/admin (Docker Compose).
# Requires replicas >= 2 and docker-compose.zd.yml (no host port clash).
# Production: api/web/admin have NO host ports; `edge` LB owns 127.0.0.1:13000/13001/14000.
#
# Env:
#   DRACORD_REPLICAS=2
#   DRACORD_COMPOSE_PROD=1|0   include docker-compose.prod.yml (default: 1 if file exists)
#   DRACORD_SKIP_BUILD=1       skip image build
#   DRACORD_ROLL_MUSIC_BOT=1   recreate music-bot after roll (default 1)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROD_FILE="$ROOT/docker/docker-compose.prod.yml"
USE_PROD="${DRACORD_COMPOSE_PROD:-}"
if [[ -z "$USE_PROD" ]]; then
  if [[ -f "$PROD_FILE" ]]; then USE_PROD=1; else USE_PROD=0; fi
fi

export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-1}"
export COMPOSE_DOCKER_CLI_BUILD="${COMPOSE_DOCKER_CLI_BUILD:-1}"

COMPOSE_FILES=(
  -f "$ROOT/docker/docker-compose.yml"
  -f "$ROOT/docker/docker-compose.zd.yml"
)
if [[ "$USE_PROD" == "1" ]]; then
  COMPOSE_FILES+=(-f "$PROD_FILE")
fi

COMPOSE=(docker compose "${COMPOSE_FILES[@]}" --env-file "$ROOT/.env")
REPLICAS="${DRACORD_REPLICAS:-2}"
SERVICES=("${@:-api web admin}")

echo "==> Compose: ${COMPOSE_FILES[*]}"
if [[ "${DRACORD_SKIP_BUILD:-0}" != "1" ]]; then
  echo "==> Building: ${SERVICES[*]}"
  "${COMPOSE[@]}" build "${SERVICES[@]}"
fi

# Drop obsolete 127.0.0.1 port publishes on app services (breaks multi-replica).
# Recreate at scale=1 first so host ports are released for `edge`.
if [[ "$USE_PROD" == "1" ]]; then
  echo "==> Releasing host ports from api/web/admin (edge will own them)"
  # Stop anything still binding loopback app ports (old single-replica publish)
  for cname in $("${COMPOSE[@]}" ps -q api web admin 2>/dev/null || true); do
    docker stop -t 15 "$cname" >/dev/null 2>&1 || true
  done
  for svc in api web admin; do
    "${COMPOSE[@]}" up -d --scale "$svc=1" --force-recreate --no-deps "$svc" || \
      "${COMPOSE[@]}" up -d --scale "$svc=1" "$svc" || true
  done
fi

roll_service() {
  local svc="$1"
  echo "==> Rolling $svc (replicas=$REPLICAS)"

  "${COMPOSE[@]}" up -d --scale "$svc=$REPLICAS" --no-recreate "$svc" || \
    "${COMPOSE[@]}" up -d --scale "$svc=$REPLICAS" "$svc"

  mapfile -t containers < <("${COMPOSE[@]}" ps -q "$svc")
  if [[ ${#containers[@]} -lt 2 ]]; then
    echo "!! $svc has <2 containers; scaling and recreating may briefly interrupt."
  fi

  for id in "${containers[@]}"; do
    echo "--> Recreating $svc container ${id:0:12}"
    docker stop -t 25 "$id" >/dev/null
    docker rm "$id" >/dev/null
    "${COMPOSE[@]}" up -d --scale "$svc=$REPLICAS" --no-recreate "$svc"
    for _ in $(seq 1 60); do
      healthy="$("${COMPOSE[@]}" ps "$svc" | grep -c '(healthy)' || true)"
      running="$("${COMPOSE[@]}" ps -q "$svc" | wc -l | tr -d ' ')"
      if [[ "$running" -ge "$REPLICAS" && "$healthy" -ge 1 ]]; then
        break
      fi
      sleep 2
    done
  done

  echo "==> $svc roll complete"
}

for svc in "${SERVICES[@]}"; do
  roll_service "$svc"
done

if [[ "$USE_PROD" == "1" ]]; then
  echo "==> Starting edge LB (127.0.0.1:13000/13001/14000)"
  "${COMPOSE[@]}" up -d edge
fi

if [[ "${DRACORD_ROLL_MUSIC_BOT:-1}" == "1" ]]; then
  echo "==> Recreating music-bot"
  "${COMPOSE[@]}" up -d --build --force-recreate --no-deps music-bot || true
fi

echo "Done."
