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
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-http}"
NETWORK="${DRACORD_TTEN_NETWORK:-ttengamesstudio_ttengamesstudio-network}"
NGINX_CTN="${DRACORD_NGINX_CONTAINER:-ttengamesstudio-nginx}"
EDGE_CTN="${DRACORD_EDGE_CONTAINER:-docker-edge-1}"
LIVEKIT_CTN="${DRACORD_LIVEKIT_CONTAINER:-docker-livekit-1}"
TTEN_TPL="${TTEN_TEMPLATES:-/opt/ttengamesstudio/docker/nginx/templates}"
CONF_NAME="dracord.conf"

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

if ! docker inspect "$EDGE_CTN" >/dev/null 2>&1; then
  echo "Edge container not found: $EDGE_CTN — start Dracord edge first." >&2
  exit 1
fi

connect_alias() {
  local ctn="$1"
  local alias="$2"
  if ! docker inspect "$ctn" >/dev/null 2>&1; then
    echo "  SKIP $ctn (missing)"
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

echo "==> Attach Dracord edge/livekit to $NETWORK"
connect_alias "$EDGE_CTN" "dracord-edge"
connect_alias "$LIVEKIT_CTN" "dracord-livekit"

# Upstream DNS must resolve before nginx -t (otherwise conf is rejected and Host falls to default)
if ! docker exec "$NGINX_CTN" getent hosts dracord-edge >/dev/null 2>&1; then
  echo "!! dracord-edge DNS yok ($NGINX_CTN içinde) — conf yüklenemez." >&2
  exit 1
fi

if [[ "$MODE" == "https" ]]; then
  if ! docker exec "$NGINX_CTN" test -f /etc/letsencrypt/live/dracord.com.tr/fullchain.pem; then
    echo "!! Cert yok: /etc/letsencrypt/live/dracord.com.tr/" >&2
    echo "   Önce: bash docker/sync-dracord-nginx.sh http" >&2
    echo "   Sonra certbot (nginx webroot), sonra tekrar https." >&2
    exit 1
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
docker cp "$SRC" "$NGINX_CTN:/etc/nginx/conf.d/$CONF_NAME"

echo "==> nginx -t + reload"
if ! docker exec "$NGINX_CTN" nginx -t; then
  echo "!! nginx -t failed — removing $CONF_NAME" >&2
  docker exec "$NGINX_CTN" rm -f "/etc/nginx/conf.d/$CONF_NAME" || true
  rm -f "$TTEN_TPL/$CONF_NAME" 2>/dev/null || true
  docker exec "$NGINX_CTN" nginx -t
  docker exec "$NGINX_CTN" nginx -s reload || true
  exit 1
fi
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

if [[ "$MODE" == "https" ]]; then
  code="$(curl -sk -o /tmp/dracord-smoke.body -w '%{http_code}' --resolve dracord.com.tr:443:127.0.0.1 \
    https://dracord.com.tr/ || echo 000)"
  echo "  HTTPS resolve→127.0.0.1 → HTTP ${code}"
  if grep -qi 'TTENGAMES\|ttengamesstudio' /tmp/dracord-smoke.body 2>/dev/null; then
    echo "!! HTTPS cevabı TTEN içeriği — vhost yanlış / default_server sızıntısı" >&2
    exit 1
  fi
fi

if [[ "$MODE" == "http" ]]; then
  echo
  echo "HTTP conf aktif. Sertifika için (webroot nginx ile uyumlu path):"
  echo "  certbot certonly --webroot -w /var/www/certbot \\"
  echo "    -d dracord.com.tr -d www.dracord.com.tr \\"
  echo "    -d api.dracord.com.tr -d admin.dracord.com.tr -d rtc.dracord.com.tr"
  echo "  (certbot host veya nginx container volume'una göre ayarla)"
  echo "  sonra: bash docker/sync-dracord-nginx.sh https"
fi

echo "Done."
