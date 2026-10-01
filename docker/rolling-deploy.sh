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

# Sequential builds — parallel yarn focus thrashs small VPS disks/network
if [[ "${DRACORD_SKIP_BUILD:-0}" != "1" ]]; then
  for svc in "${SERVICES[@]}"; do
    echo "==> Building: $svc"
    "${COMPOSE[@]}" build "$svc"
  done
fi

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

# Only when app containers still publish loopback ports that edge needs.
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
  echo "==> Rolling $svc (replicas=$REPLICAS)"

  "${COMPOSE[@]}" up -d --scale "$svc=$REPLICAS" --no-recreate "$svc" || \
    "${COMPOSE[@]}" up -d --scale "$svc=$REPLICAS" "$svc"

  mapfile -t containers < <("${COMPOSE[@]}" ps -q "$svc")
  if [[ ${#containers[@]} -lt 2 ]]; then
    echo "!! $svc has <2 containers; scaling and recreating may briefly interrupt."
  fi

  for id in "${containers[@]}"; do
    [[ -n "${id:-}" ]] || continue
    echo "--> Recreating $svc container ${id:0:12}"
    docker stop -t 25 "$id" >/dev/null
    docker rm "$id" >/dev/null
    "${COMPOSE[@]}" up -d --scale "$svc=$REPLICAS" --no-recreate "$svc"
    wait_healthy "$svc" "$REPLICAS"
  done

  echo "==> $svc roll complete"
}

release_host_ports_if_needed

for svc in "${SERVICES[@]}"; do
  roll_service "$svc"
done

if [[ "$USE_PROD" == "1" ]]; then
  # CRITICAL: plain `up -d edge` reconciles the project and can scale api/web/admin
  # back to 1 (or leave orphaned *-3/*-4 unhealthy). Lock scales, then edge --no-deps.
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
  # Docker dosya yoksa dizin yaratır; cookies mount bozulmasın
  COOKIES_HOST="${YTDLP_COOKIES_HOST_PATH:-/opt/dracord/secrets/youtube-cookies.txt}"
  mkdir -p "$(dirname "$COOKIES_HOST")"
  ENV_FILE="${COMPOSE_ENV_FILE:-/opt/dracord/.env}"
  # .env’de B64 varsa her recreate’te dosyayı senkronla (reboot/stub sonrası boş kalmasın)
  if [[ -f "$ENV_FILE" ]] && grep -q '^YTDLP_COOKIES_B64=' "$ENV_FILE"; then
    python3 - <<PY || true
import base64, os, re
env = open("${ENV_FILE}", encoding="utf-8", errors="ignore").read()
m = re.search(r"^YTDLP_COOKIES_B64=(.+)$", env, re.M)
if not m:
    raise SystemExit(0)
raw = base64.b64decode(m.group(1).strip().encode("ascii"), validate=False)
path = "${COOKIES_HOST}"
open(path, "wb").write(raw)
os.chmod(path, 0o600)
print(f"==> Synced cookies from YTDLP_COOKIES_B64 → {path} ({len(raw)} bytes)")
PY
  elif [[ ! -e "$COOKIES_HOST" ]]; then
    echo "# Netscape HTTP Cookie File" > "$COOKIES_HOST"
    chmod 600 "$COOKIES_HOST" || true
    echo "==> Created empty cookies stub: $COOKIES_HOST (YouTube bot duvarı için gerçek cookie gerekli)"
  elif ! grep -q $'\t' "$COOKIES_HOST" 2>/dev/null; then
    echo "==> UYARI: $COOKIES_HOST boş/stub — YTDLP_COOKIES_B64 yok. push-youtube-cookies.ps1 çalıştır." >&2
  fi
  echo "==> Recreating music-bot"
  "${COMPOSE[@]}" up -d --build --force-recreate --no-deps music-bot || true
fi

echo "Done."
