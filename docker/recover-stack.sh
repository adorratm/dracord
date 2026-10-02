#!/usr/bin/env bash
# Recovery after a failed rolling deploy.
# Prefers :previous images so a bad :latest does not wipe a working fleet.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPLICAS="${DRACORD_REPLICAS:-2}"
export DRACORD_COMPOSE_PROD=1
export DOCKER_BUILDKIT=1

COMPOSE=(docker compose
  -f docker/docker-compose.yml
  -f docker/docker-compose.zd.yml
  -f docker/docker-compose.prod.yml
  --env-file .env
)

PROJECT=docker

# Prefer label from a running api container (compose project name)
_id="$("${COMPOSE[@]}" ps -q api 2>/dev/null | head -n 1 || true)"
if [[ -n "${_id:-}" ]]; then
  _p="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$_id" 2>/dev/null || true)"
  [[ -n "${_p:-}" ]] && PROJECT="$_p"
fi
PROJECT="${COMPOSE_PROJECT_NAME:-$PROJECT}"

restore_previous() {
  local svc="$1"
  local img="${PROJECT}-${svc}"
  if docker image inspect "${img}:previous" >/dev/null 2>&1; then
    echo "    $svc ← ${img}:previous"
    docker tag "${img}:previous" "${img}:latest"
  else
    echo "    $svc: no :previous tag (keeping current :latest)"
  fi
}

wait_healthy() {
  local svc="$1"
  local want="$2"
  for _ in $(seq 1 90); do
    local h r
    h="$("${COMPOSE[@]}" ps "$svc" 2>/dev/null | grep -c '(healthy)' || true)"
    r="$("${COMPOSE[@]}" ps -q "$svc" 2>/dev/null | wc -l | tr -d ' ')"
    if [[ "${r:-0}" -ge "$want" && "${h:-0}" -ge "$want" ]]; then
      echo "    $svc ok ($h/$r healthy)"
      return 0
    fi
    sleep 2
  done
  echo "!! $svc not healthy (want=$want)"
  "${COMPOSE[@]}" ps "$svc" || true
  return 1
}

echo "==> Restore :previous images (if present)"
for svc in api web admin; do
  restore_previous "$svc"
done

echo "==> Normalize api/web/admin to $REPLICAS replicas + start edge"
"${COMPOSE[@]}" up -d \
  --scale "api=$REPLICAS" \
  --scale "web=$REPLICAS" \
  --scale "admin=$REPLICAS" \
  --force-recreate \
  --no-deps \
  api web admin

echo "==> Wait for health"
wait_healthy api "$REPLICAS"
wait_healthy web "$REPLICAS"
wait_healthy admin "$REPLICAS"

"${COMPOSE[@]}" up -d --no-deps --force-recreate edge
sleep 3
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:14000/health/ready 2>/dev/null; then
    break
  fi
  sleep 1
done

echo "==> Smoke"
curl -fsS -o /dev/null -w "web %{http_code}\n" http://127.0.0.1:13000/health || true
curl -fsS -o /dev/null -w "api %{http_code}\n" http://127.0.0.1:14000/health/ready || true
curl -fsS -o /dev/null -w "admin %{http_code}\n" http://127.0.0.1:13001/health || true
"${COMPOSE[@]}" ps
echo "Done. Public HTTPS needs: bash docker/sync-dracord-nginx.sh http|https"
