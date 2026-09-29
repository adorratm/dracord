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

echo "==> Normalize api/web/admin to $REPLICAS replicas + start edge"
"${COMPOSE[@]}" up -d \
  --scale "api=$REPLICAS" \
  --scale "web=$REPLICAS" \
  --scale "admin=$REPLICAS" \
  --force-recreate \
  --no-deps \
  api web admin

echo "==> Wait for health"
for svc in api web admin; do
  for _ in $(seq 1 60); do
    h="$("${COMPOSE[@]}" ps "$svc" | grep -c '(healthy)' || true)"
    r="$("${COMPOSE[@]}" ps -q "$svc" | wc -l | tr -d ' ')"
    if [[ "$r" -ge "$REPLICAS" && "$h" -ge "$REPLICAS" ]]; then
      echo "    $svc ok ($h/$r healthy)"
      break
    fi
    sleep 3
  done
done

"${COMPOSE[@]}" up -d --no-deps edge

echo "==> Smoke"
curl -fsS -o /dev/null -w "web %{http_code}\n" http://127.0.0.1:13000/health || true
curl -fsS -o /dev/null -w "api %{http_code}\n" http://127.0.0.1:14000/health/ready || true
"${COMPOSE[@]}" ps
echo "Done. If other domains are swapped, fix host Nginx server_name blocks (not this stack)."
