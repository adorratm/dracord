#!/usr/bin/env bash
# One-shot recovery after a failed rolling deploy (orphaned api-3/web-4, edge down).
# Does NOT touch host Nginx or other sites — only the dracord compose project.
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
# edge needs a moment after port publish
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
