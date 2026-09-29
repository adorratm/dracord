#!/usr/bin/env bash
# Zero-downtime rolling deploy for api/web/admin (Docker Compose).
# Requires replicas >= 2 and docker-compose.zd.yml (no host port clash).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE=(docker compose -f "$ROOT/docker/docker-compose.yml" -f "$ROOT/docker/docker-compose.zd.yml" --env-file "$ROOT/.env")
REPLICAS="${DRACORD_REPLICAS:-2}"
SERVICES=("${@:-api web admin}")

echo "==> Building: ${SERVICES[*]}"
"${COMPOSE[@]}" build "${SERVICES[@]}"

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

echo "Done."
