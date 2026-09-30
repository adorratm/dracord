#!/usr/bin/env bash
# Remote entrypoint for GitHub Actions → Hetzner.
# Secrets live only in server .env (never in the public git tree).
set -euo pipefail

DEPLOY_PATH="${DRACORD_DEPLOY_PATH:-/opt/dracord}"
BRANCH="${DRACORD_DEPLOY_BRANCH:-main}"
REPLICAS="${DRACORD_REPLICAS:-2}"

cd "$DEPLOY_PATH"

if [[ ! -f .env ]]; then
  echo "Missing $DEPLOY_PATH/.env — create it on the server; never commit .env." >&2
  exit 1
fi

# Soft-fail if .env still looks like the public example
if grep -qE 'JWT_ACCESS_SECRET=change-me|LIVEKIT_API_SECRET=secret_dracord_livekit_dev' .env; then
  echo "Production .env still contains example secrets — refuse to deploy." >&2
  exit 1
fi

# YouTube müzik botu: cookie yoksa bot duvarı kaçınılmaz
if ! grep -qE '^YTDLP_COOKIES_B64=.+' .env \
  && { [[ ! -f /opt/dracord/secrets/youtube-cookies.txt ]] || ! grep -q $'\t' /opt/dracord/secrets/youtube-cookies.txt 2>/dev/null; }; then
  echo "==> UYARI: YTDLP_COOKIES_B64 / youtube-cookies.txt yok — YouTube çalma bot check ile düşer." >&2
  echo "    PC: scripts/encode-youtube-cookies.ps1 && scripts/push-youtube-cookies.ps1" >&2
fi

if [[ "${DRACORD_SKIP_GIT:-0}" != "1" ]]; then
  echo "==> Sync $DEPLOY_PATH (branch=$BRANCH)"
  git fetch --prune origin
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
  # Never git clean — would risk deleting untracked .env / livekit.prod.yaml
fi

export DRACORD_COMPOSE_PROD=1
export DRACORD_REPLICAS="$REPLICAS"
export DRACORD_ROLL_MUSIC_BOT="${DRACORD_ROLL_MUSIC_BOT:-1}"
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "==> Disk / Docker usage (slow yarn fetch often = full disk or no BuildKit cache)"
df -h / /var/lib/docker 2>/dev/null || df -h /
docker system df 2>/dev/null || true
# If root filesystem is critically full, free dangling build junk (safe for other stacks)
ROOT_USE="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
if [[ "${ROOT_USE:-0}" -ge 90 ]]; then
  echo "==> Disk >=90% — pruning dangling images/build cache (containers kept)"
  docker builder prune -f >/dev/null || true
  docker image prune -f >/dev/null || true
fi

echo "==> Generate LiveKit prod config from .env"
bash docker/generate-livekit-prod.sh .env

echo "==> Ensure data plane"
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.zd.yml \
  -f docker/docker-compose.prod.yml \
  --env-file .env \
  up -d postgres pgbouncer redis elasticsearch livekit

if ! bash docker/rolling-deploy.sh api web admin; then
  echo "==> Rolling deploy failed — attempting stack recover (replicas + edge)"
  bash docker/recover-stack.sh || true
  exit 1
fi

docker image prune -f >/dev/null || true

echo "==> Smoke (local loopback)"
curl -fsS -o /dev/null -w "web %{http_code}\n" http://127.0.0.1:13000/health || true
curl -fsS -o /dev/null -w "api %{http_code}\n" http://127.0.0.1:14000/health/ready || true
curl -fsS -o /dev/null -w "admin %{http_code}\n" http://127.0.0.1:13001/health || true

# Public routing is Docker Nginx — ensure edge is on TTEN network + vhost present
if [[ "${DRACORD_SYNC_NGINX:-1}" == "1" ]]; then
  echo "==> Sync Dracord → ttengamesstudio-nginx"
  if docker exec ttengamesstudio-nginx test -f /etc/letsencrypt/live/dracord.com.tr/fullchain.pem 2>/dev/null; then
    bash docker/sync-dracord-nginx.sh https || bash docker/sync-dracord-nginx.sh http || true
  else
    bash docker/sync-dracord-nginx.sh http || true
  fi
fi

echo "==> Deploy finished"
