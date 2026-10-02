#!/usr/bin/env bash
# Wire Dracord edge into shared Docker Nginx (ttengamesstudio-nginx).
#
# SAFETY (shared Hetzner — 5 sites):
#   - Only writes conf.d/dracord.conf (+ host templates mirror) — never touches
#     kiliccoffee / portfolio / TTEN default server_name list.
#   - Never run kiliccofferoaster deploy/recover-nginx.sh from a Dracord deploy.
#   - Only connects docker-edge-1 / docker-livekit-1 to the TTEN network.
#
# Usage:
#   bash docker/sync-dracord-nginx.sh http    # no TLS yet (ACME-friendly)
#   bash docker/sync-dracord-nginx.sh https   # requires certs under live/dracord.com.tr
#   bash docker/sync-dracord-nginx.sh auto    # https if certs exist, else http
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-auto}"
NETWORK="${DRACORD_TTEN_NETWORK:-ttengamesstudio_ttengamesstudio-network}"
NGINX_CTN="${DRACORD_NGINX_CONTAINER:-ttengamesstudio-nginx}"
EDGE_CTN="${DRACORD_EDGE_CONTAINER:-docker-edge-1}"
LIVEKIT_CTN="${DRACORD_LIVEKIT_CONTAINER:-docker-livekit-1}"
TTEN_TPL="${TTEN_TEMPLATES:-/opt/ttengamesstudio/docker/nginx/templates}"
CONF_NAME="dracord.conf"

if [[ "$MODE" == "auto" ]]; then
  if docker inspect "$NGINX_CTN" >/dev/null 2>&1 \
    && docker exec "$NGINX_CTN" test -f /etc/letsencrypt/live/dracord.com.tr/fullchain.pem 2>/dev/null; then
    MODE=https
  else
    MODE=http
  fi
  echo "==> auto → $MODE"
fi

if [[ "$MODE" == "https" ]]; then
  SRC="$ROOT/docker/nginx-dracord.docker.conf.example"
else
  SRC="$ROOT/docker/nginx-dracord.docker.http.conf.example"
  MODE=http
fi

if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC" >&2
  exit 1
fi

if ! docker inspect "$NGINX_CTN" >/dev/null 2>&1; then
  echo "Nginx container not found: $NGINX_CTN" >&2
  exit 1
fi

# Resolve edge container name (compose project may differ)
if ! docker inspect "$EDGE_CTN" >/dev/null 2>&1; then
  EDGE_CTN="$(docker ps --format '{{.Names}}' | grep -E 'edge' | grep -i dracord | head -n1 || true)"
  if [[ -z "${EDGE_CTN:-}" ]]; then
    EDGE_CTN="$(docker ps --format '{{.Names}}' | grep -E '^docker-edge-|^dracord-.*edge' | head -n1 || true)"
  fi
fi
if [[ -z "${EDGE_CTN:-}" ]] || ! docker inspect "$EDGE_CTN" >/dev/null 2>&1; then
  echo "Edge container not found — start Dracord edge first." >&2
  exit 1
fi

if ! docker inspect "$LIVEKIT_CTN" >/dev/null 2>&1; then
  LIVEKIT_CTN="$(docker ps --format '{{.Names}}' | grep -E 'livekit' | head -n1 || true)"
fi

connect_alias() {
  local ctn="$1"
  local alias="$2"
  if [[ -z "${ctn:-}" ]] || ! docker inspect "$ctn" >/dev/null 2>&1; then
    echo "  SKIP $alias (container missing)"
    return 0
  fi
  # Prefer keep existing attachment; only reconnect when alias DNS is missing.
  if docker network inspect "$NETWORK" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null \
    | grep -qw "$ctn"; then
    if docker exec "$NGINX_CTN" getent hosts "$alias" >/dev/null 2>&1; then
      echo "  OK  $ctn on $NETWORK (alias $alias)"
      return 0
    fi
    echo "  .. reconnect $ctn for alias $alias"
    docker network disconnect "$NETWORK" "$ctn" 2>/dev/null || true
  fi
  docker network connect --alias "$alias" "$NETWORK" "$ctn"
  echo "  OK  $ctn → $NETWORK as $alias"
}

echo "==> Attach Dracord edge/livekit to $NETWORK (edge=$EDGE_CTN)"
connect_alias "$EDGE_CTN" "dracord-edge"
connect_alias "$LIVEKIT_CTN" "dracord-livekit"

# Wait for DNS (edge recreate race) — conf no longer requires it for nginx -t,
# but we still want alias up for traffic.
for i in $(seq 1 20); do
  if docker exec "$NGINX_CTN" getent hosts dracord-edge >/dev/null 2>&1; then
    break
  fi
  echo "  .. waiting dracord-edge DNS ($i/20)"
  sleep 1
  # Re-try connect periodically
  if (( i % 5 == 0 )); then
    connect_alias "$EDGE_CTN" "dracord-edge" || true
  fi
done

if [[ "$MODE" == "https" ]]; then
  if ! docker exec "$NGINX_CTN" test -f /etc/letsencrypt/live/dracord.com.tr/fullchain.pem; then
    echo "!! Cert yok: /etc/letsencrypt/live/dracord.com.tr/" >&2
    echo "   Falling back to http conf so vhost is not lost." >&2
    MODE=http
    SRC="$ROOT/docker/nginx-dracord.docker.http.conf.example"
  fi
fi

echo "==> Install $CONF_NAME ($MODE) into $NGINX_CTN (+ host templates mirror)"
# Persist on host templates so TTEN nginx recreate/entrypoint restores sibling vhost
if [[ -d "$TTEN_TPL" ]]; then
  cp "$SRC" "$TTEN_TPL/$CONF_NAME"
  echo "  + host templates → $TTEN_TPL/$CONF_NAME"
else
  echo "  UYARI: $TTEN_TPL yok — sadece container conf.d yazılacak (recreate'de kaybolur)"
fi

# Keep previous conf if new one fails validation — never leave Host without vhost
PREV_BACKUP="$(mktemp)"
docker exec "$NGINX_CTN" cat "/etc/nginx/conf.d/$CONF_NAME" >"$PREV_BACKUP" 2>/dev/null || true

docker cp "$SRC" "$NGINX_CTN:/etc/nginx/conf.d/$CONF_NAME"

echo "==> nginx -t + reload"
if ! docker exec "$NGINX_CTN" nginx -t; then
  echo "!! nginx -t failed — restoring previous $CONF_NAME (if any)" >&2
  if [[ -s "$PREV_BACKUP" ]]; then
    docker cp "$PREV_BACKUP" "$NGINX_CTN:/etc/nginx/conf.d/$CONF_NAME"
  else
    docker exec "$NGINX_CTN" rm -f "/etc/nginx/conf.d/$CONF_NAME" || true
  fi
  rm -f "$PREV_BACKUP"
  docker exec "$NGINX_CTN" nginx -t || true
  docker exec "$NGINX_CTN" nginx -s reload || true
  exit 1
fi
rm -f "$PREV_BACKUP"
docker exec "$NGINX_CTN" nginx -s reload

echo "==> Smoke"
curl -sS -o /dev/null -w "Host dracord.com.tr → %{http_code}\n" \
  -H "Host: dracord.com.tr" http://127.0.0.1/health || true
curl -sS -o /dev/null -w "loopback edge web → %{http_code}\n" \
  http://127.0.0.1:13000/health || true

if ! docker exec "$NGINX_CTN" nginx -T 2>/dev/null | grep -q 'server_name dracord.com.tr'; then
  echo "!! nginx -T içinde dracord.com.tr yok" >&2
  exit 1
fi
echo "  OK  nginx vhost: dracord.com.tr"

BODY="$(mktemp)"
code="$(curl -sS -o "$BODY" -w '%{http_code}' -H "Host: dracord.com.tr" http://127.0.0.1/ 2>/dev/null || echo 000)"
if grep -qi 'No vhost for this host\|Check sibling nginx' "$BODY" 2>/dev/null; then
  echo "!! Hâlâ 'No vhost' — TTEN default_server sızıntısı" >&2
  rm -f "$BODY"
  exit 1
fi
rm -f "$BODY"
echo "  OK  Host header smoke HTTP ${code}"

if [[ "$MODE" == "https" ]]; then
  code="$(curl -sk -o /tmp/dracord-smoke.body -w '%{http_code}' --resolve dracord.com.tr:443:127.0.0.1 \
    https://dracord.com.tr/ || echo 000)"
  echo "  HTTPS resolve→127.0.0.1 → HTTP ${code}"
  if grep -qi 'TTENGAMES\|ttengamesstudio\|No vhost for this host' /tmp/dracord-smoke.body 2>/dev/null; then
    echo "!! HTTPS cevabı yanlış vhost / default_server" >&2
    exit 1
  fi
fi

if [[ "$MODE" == "http" ]]; then
  echo
  echo "HTTP conf aktif. Sertifika için:"
  echo "  certbot certonly --webroot -w /var/www/certbot \\"
  echo "    -d dracord.com.tr -d www.dracord.com.tr \\"
  echo "    -d api.dracord.com.tr -d admin.dracord.com.tr -d rtc.dracord.com.tr"
  echo "  sonra: bash docker/sync-dracord-nginx.sh https"
fi

echo "Done."
