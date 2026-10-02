#!/usr/bin/env bash
# Zero-downtime rolling deploy for api/web/admin (Docker Compose).
#
# Model (blue-green lite):
#   1) Tag currently running images as :previous (rollback hedefi)
#   2) Build NEW images as :latest — running containers keep old layers (build ≠ downtime)
#   3) Roll: scale N→N+1 (yeni healthy olunca), sonra en eski container’ı kaldır
#   4) Fail: :previous’a geri dön; bozuk :latest ile force-recreate YAPMA
#
# Env:
#   DRACORD_REPLICAS=2
#   DRACORD_COMPOSE_PROD=1|0
#   DRACORD_SKIP_BUILD=1
#   DRACORD_ROLL_MUSIC_BOT=1
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
if [[ $# -eq 0 ]]; then
  SERVICES=(api web admin)
else
  SERVICES=("$@")
fi

# Project name = compose project label (containers are docker-api-N → project "docker")
# Do NOT use `compose ls` (lists unrelated stacks like ttengamesstudio).
detect_project() {
  local id
  id="$("${COMPOSE[@]}" ps -q api 2>/dev/null | head -n 1 || true)"
  if [[ -n "${id:-}" ]]; then
    docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$id" 2>/dev/null || true
  fi
}
PROJECT="$(detect_project)"
if [[ -z "${PROJECT:-}" ]]; then
  # compose files live in docker/ → default project name is "docker"
  PROJECT="${COMPOSE_PROJECT_NAME:-docker}"
fi

image_ref() {
  echo "${PROJECT}-$1"
}

wait_healthy() {
  local svc="$1"
  local want="$2"
  local healthy=0 running=0
  for _ in $(seq 1 90); do
    healthy="$("${COMPOSE[@]}" ps "$svc" 2>/dev/null | grep -c '(healthy)' || true)"
    running="$("${COMPOSE[@]}" ps -q "$svc" 2>/dev/null | wc -l | tr -d ' ')"
    if [[ "${running:-0}" -ge "$want" && "${healthy:-0}" -ge "$want" ]]; then
      return 0
    fi
    sleep 2
  done
  echo "!! Timeout waiting for $svc (want=$want running=${running:-0} healthy=${healthy:-0})"
  "${COMPOSE[@]}" ps "$svc" || true
  for id in $("${COMPOSE[@]}" ps -q "$svc" 2>/dev/null || true); do
    echo "----- $svc logs ${id:0:12} -----"
    docker logs --tail 100 "$id" 2>&1 || true
  done
  return 1
}

snapshot_previous() {
  local svc="$1"
  local img
  img="$(image_ref "$svc")"
  if docker image inspect "${img}:latest" >/dev/null 2>&1; then
    docker tag "${img}:latest" "${img}:previous"
    echo "    tagged ${img}:previous"
  else
    echo "    (no ${img}:latest yet — first deploy)"
  fi
}

rollback_service() {
  local svc="$1"
  local img
  img="$(image_ref "$svc")"
  if ! docker image inspect "${img}:previous" >/dev/null 2>&1; then
    echo "!! No ${img}:previous — cannot rollback $svc"
    return 1
  fi
  echo "==> Rollback $svc → ${img}:previous"
  docker tag "${img}:previous" "${img}:latest"
  "${COMPOSE[@]}" up -d --no-deps --force-recreate --scale "$svc=$REPLICAS" "$svc"
  wait_healthy "$svc" "$REPLICAS" || true
}

# Oldest container id for a service (by Created timestamp)
oldest_container() {
  local svc="$1"
  local best_id="" best_ts=""
  local id created
  for id in $("${COMPOSE[@]}" ps -q "$svc" 2>/dev/null || true); do
    created="$(docker inspect -f '{{.Created}}' "$id" 2>/dev/null || true)"
    if [[ -z "$best_ts" || "$created" < "$best_ts" ]]; then
      best_ts="$created"
      best_id="$id"
    fi
  done
  echo "$best_id"
}

echo "==> Compose: ${COMPOSE_FILES[*]} (project=$PROJECT)"

echo "==> Snapshot running images as :previous"
for svc in "${SERVICES[@]}"; do
  snapshot_previous "$svc"
done

if [[ "${DRACORD_SKIP_BUILD:-0}" != "1" ]]; then
  echo "==> Building (parallel): ${SERVICES[*]}"
  if ! "${COMPOSE[@]}" build --parallel "${SERVICES[@]}"; then
    echo "    --parallel failed; sequential build"
    for svc in "${SERVICES[@]}"; do
      echo "==> Building: $svc"
      "${COMPOSE[@]}" build "$svc"
    done
  fi
fi

release_host_ports_if_needed() {
  [[ "$USE_PROD" == "1" ]] || return 0
  local clash=0
  while read -r line; do
    if echo "$line" | grep -qE ':(13000|13001|14000)->'; then
      clash=1
      break
    fi
  done < <(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E 'docker-(api|web|admin)-' || true)

  if [[ "$clash" -ne 1 ]]; then
    echo "==> App services already without conflicting host ports"
    return 0
  fi

  echo "==> Releasing host ports from api/web/admin (edge will own them)"
  for cname in $("${COMPOSE[@]}" ps -q api web admin 2>/dev/null || true); do
    docker stop -t 15 "$cname" >/dev/null 2>&1 || true
  done
  for svc in api web admin; do
    "${COMPOSE[@]}" up -d --scale "$svc=1" --force-recreate --no-deps "$svc" || \
      "${COMPOSE[@]}" up -d --scale "$svc=1" "$svc" || true
  done
}

roll_service() {
  local svc="$1"
  echo "==> Rolling $svc (replicas=$REPLICAS) — scale-up then drain"

  "${COMPOSE[@]}" up -d --scale "$svc=$REPLICAS" --no-recreate "$svc" || \
    "${COMPOSE[@]}" up -d --scale "$svc=$REPLICAS" "$svc"

  local i target old
  for i in $(seq 1 "$REPLICAS"); do
    target=$((REPLICAS + 1))
    echo "--> $svc wave $i/$REPLICAS: scale to $target"
    "${COMPOSE[@]}" up -d --scale "$svc=$target" --no-recreate "$svc"

    if ! wait_healthy "$svc" "$target"; then
      echo "!! New $svc replica unhealthy — rolling back to :previous"
      rollback_service "$svc"
      return 1
    fi

    old="$(oldest_container "$svc")"
    if [[ -n "$old" ]]; then
      echo "--> Draining old $svc ${old:0:12}"
      docker stop -t 25 "$old" >/dev/null || true
      docker rm "$old" >/dev/null || true
    fi

    "${COMPOSE[@]}" up -d --scale "$svc=$REPLICAS" --no-recreate "$svc" || true
    if ! wait_healthy "$svc" "$REPLICAS"; then
      echo "!! $svc unhealthy after drain — rollback"
      rollback_service "$svc"
      return 1
    fi
  done

  echo "==> $svc roll complete"
}

release_host_ports_if_needed

ROLL_FAILED=0
for svc in "${SERVICES[@]}"; do
  if ! roll_service "$svc"; then
    ROLL_FAILED=1
    break
  fi
done

if [[ "$ROLL_FAILED" -eq 1 ]]; then
  echo "==> Deploy aborted after rollback attempt (old :previous should be serving)"
  exit 1
fi

if [[ "$USE_PROD" == "1" ]]; then
  echo "==> Locking replica scales before edge"
  "${COMPOSE[@]}" up -d \
    --scale "api=$REPLICAS" \
    --scale "web=$REPLICAS" \
    --scale "admin=$REPLICAS" \
    --no-recreate \
    api web admin
  wait_healthy api "$REPLICAS"
  wait_healthy web "$REPLICAS"
  wait_healthy admin "$REPLICAS"

  echo "==> Starting edge LB (--no-deps; 127.0.0.1:13000/13001/14000)"
  "${COMPOSE[@]}" up -d --no-deps --force-recreate edge
fi

if [[ "${DRACORD_ROLL_MUSIC_BOT:-1}" == "1" ]]; then
  COOKIES_HOST="${YTDLP_COOKIES_HOST_PATH:-/opt/dracord/secrets/youtube-cookies.txt}"
  mkdir -p "$(dirname "$COOKIES_HOST")"
  ENV_FILE="${COMPOSE_ENV_FILE:-/opt/dracord/.env}"
  if [[ -f "$ENV_FILE" ]] && grep -q '^YTDLP_COOKIES_B64=' "$ENV_FILE"; then
    ENV_FILE="$ENV_FILE" COOKIES_HOST="$COOKIES_HOST" python3 - <<'PY' || true
import base64, os, re
env_path = os.environ["ENV_FILE"]
cookies_host = os.environ["COOKIES_HOST"]
env = open(env_path, encoding="utf-8", errors="ignore").read()
m = re.search(r"^YTDLP_COOKIES_B64=(.+)$", env, re.M)
if not m:
    raise SystemExit(0)
raw = base64.b64decode(m.group(1).strip().encode("ascii"), validate=False)
open(cookies_host, "wb").write(raw)
os.chmod(cookies_host, 0o600)
print(f"==> Synced cookies from YTDLP_COOKIES_B64 → {cookies_host} ({len(raw)} bytes)")
PY
  elif [[ ! -e "$COOKIES_HOST" ]]; then
    echo "# Netscape HTTP Cookie File" > "$COOKIES_HOST"
    chmod 600 "$COOKIES_HOST" || true
  elif ! grep -q $'\t' "$COOKIES_HOST" 2>/dev/null; then
    echo "==> UYARI: $COOKIES_HOST boş/stub" >&2
  fi
  echo "==> Recreating music-bot"
  "${COMPOSE[@]}" up -d --build --force-recreate --no-deps music-bot || true
fi

echo "Done."
