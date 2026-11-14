#!/usr/bin/env bash
# Run COOMBIE (coombie.dracord.com.tr) on the shared Hetzner host next to Dracord.
#
#   - pulls ghcr.io/adorratm/coombie:latest (built by the coombie repo's Image workflow)
#   - restarts the `coombie-game` container only when the image changed (or it is not running)
#   - attaches it to the TTEN network as `coombie-game` (no host port: nothing to clash with)
#   - installs conf.d/coombie.conf into ttengamesstudio-nginx, nginx -t guarded with rollback
#
# SAFETY (shared host, 5 sites): touches only the coombie-game container and coombie.conf.
# Never edits dracord.conf or another site's vhost. A failed nginx -t restores the previous file.
#
# Optional server config: /opt/coombie/.env (DRACORD_GAME_SECRET=... for sign-in from Dracord).
# Usage: bash docker/deploy-coombie.sh            (from the Dracord checkout)
#        COOMBIE_FORCE=1 bash docker/deploy-coombie.sh   (restart even if unchanged)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${COOMBIE_IMAGE:-ghcr.io/adorratm/coombie:latest}"
CTN="${COOMBIE_CONTAINER:-coombie-game}"
ALIAS="coombie-game"
ENV_FILE="${COOMBIE_ENV_FILE:-/opt/coombie/.env}"
NETWORK="${DRACORD_TTEN_NETWORK:-ttengamesstudio_ttengamesstudio-network}"
NGINX_CTN="${DRACORD_NGINX_CONTAINER:-ttengamesstudio-nginx}"
TTEN_TPL="${TTEN_TEMPLATES:-/opt/ttengamesstudio/docker/nginx/templates}"
CONF_NAME="coombie.conf"
HOST_NAME="coombie.dracord.com.tr"

echo "==> COOMBIE image $IMAGE"
docker pull "$IMAGE" >/dev/null
NEW_ID="$(docker image inspect --format '{{.Id}}' "$IMAGE")"
OLD_ID="$(docker inspect --format '{{.Image}}' "$CTN" 2>/dev/null || true)"
RUNNING="$(docker inspect --format '{{.State.Running}}' "$CTN" 2>/dev/null || echo false)"

run_game() {
  local image="$1"
  local env_args=()
  [[ -f "$ENV_FILE" ]] && env_args=(--env-file "$ENV_FILE")
  docker rm -f "$CTN" >/dev/null 2>&1 || true
  docker run -d --name "$CTN" \
    --restart unless-stopped \
    --network "$NETWORK" --network-alias "$ALIAS" \
    --memory 768m --cpus 1 \
    -e NODE_ENV=production \
    -e CORS_ORIGIN="https://${HOST_NAME}" \
    -e DRACORD_API_URL="https://api.dracord.com.tr" \
    "${env_args[@]}" \
    "$image" >/dev/null
}

wait_healthy() {
  for _ in $(seq 1 40); do
    if docker exec "$CTN" node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

if [[ "$NEW_ID" == "$OLD_ID" && "$RUNNING" == "true" && "${COOMBIE_FORCE:-0}" != "1" ]]; then
  echo "  OK  $CTN already runs this image — no restart"
else
  echo "==> (Re)start $CTN"
  run_game "$IMAGE"
  if ! wait_healthy; then
    echo "!! $CTN not healthy — logs:" >&2
    docker logs --tail 60 "$CTN" >&2 || true
    if [[ -n "$OLD_ID" ]]; then
      echo "!! rolling back to previous image ${OLD_ID:7:12}" >&2
      run_game "$OLD_ID"
      wait_healthy || echo "!! previous image not healthy either" >&2
    fi
    exit 1
  fi
  echo "  OK  $CTN healthy"
fi
# make sure the alias resolves for nginx even if the network was recreated
if ! docker exec "$NGINX_CTN" getent hosts "$ALIAS" >/dev/null 2>&1; then
  docker network disconnect "$NETWORK" "$CTN" >/dev/null 2>&1 || true
  docker network connect --alias "$ALIAS" "$NETWORK" "$CTN"
fi

echo "==> nginx vhost $CONF_NAME"
CERT_DIR="live/dracord.com.tr"
if docker exec "$NGINX_CTN" test -f "/etc/letsencrypt/live/${HOST_NAME}/fullchain.pem" 2>/dev/null; then
  CERT_DIR="live/${HOST_NAME}"
elif ! docker exec "$NGINX_CTN" sh -c "openssl x509 -noout -ext subjectAltName -in /etc/letsencrypt/live/dracord.com.tr/fullchain.pem 2>/dev/null | grep -q '${HOST_NAME}'"; then
  echo "  NOTE  the Dracord certificate does not list ${HOST_NAME}."
  echo "        Works behind Cloudflare SSL 'Full'; with 'Full (strict)' Cloudflare shows 526 until you issue one:"
  echo "        certbot certonly --webroot -w /var/www/certbot -d ${HOST_NAME}   (then re-run this script)"
fi
RENDERED="$(mktemp)"
sed "s#__COOMBIE_CERT_DIR__#${CERT_DIR}#g" "$ROOT/docker/nginx-coombie.docker.conf.example" >"$RENDERED"

PREV_BACKUP="$(mktemp)"
docker exec "$NGINX_CTN" cat "/etc/nginx/conf.d/$CONF_NAME" >"$PREV_BACKUP" 2>/dev/null || true
docker cp "$RENDERED" "$NGINX_CTN:/etc/nginx/conf.d/$CONF_NAME"
if ! docker exec "$NGINX_CTN" nginx -t; then
  echo "!! nginx -t failed — restoring previous $CONF_NAME" >&2
  if [[ -s "$PREV_BACKUP" ]]; then
    docker cp "$PREV_BACKUP" "$NGINX_CTN:/etc/nginx/conf.d/$CONF_NAME"
  else
    docker exec "$NGINX_CTN" rm -f "/etc/nginx/conf.d/$CONF_NAME" || true
  fi
  docker exec "$NGINX_CTN" nginx -t && docker exec "$NGINX_CTN" nginx -s reload || true
  rm -f "$PREV_BACKUP" "$RENDERED"
  exit 1
fi
docker exec "$NGINX_CTN" nginx -s reload
# persist across a TTEN nginx recreate, like dracord.conf
if [[ -d "$TTEN_TPL" ]]; then cp "$RENDERED" "$TTEN_TPL/$CONF_NAME"; fi
rm -f "$PREV_BACKUP" "$RENDERED"

echo "==> Smoke"
code="$(curl -sS -o /tmp/coombie-smoke.body -w '%{http_code}' -H "Host: ${HOST_NAME}" http://127.0.0.1/health || echo 000)"
echo "  Host ${HOST_NAME} via nginx :80 → HTTP ${code}"
if grep -qi 'No vhost for this host' /tmp/coombie-smoke.body 2>/dev/null; then
  echo "!! nginx still answers 'No vhost' for ${HOST_NAME}" >&2
  exit 1
fi
# Dracord itself must be untouched
curl -sS -o /dev/null -w "  Host dracord.com.tr via nginx → HTTP %{http_code}\n" -H "Host: dracord.com.tr" http://127.0.0.1/health || true
echo "Done."
