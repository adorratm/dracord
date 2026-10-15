#!/usr/bin/env bash
# Pull CI-built images from GHCR and retag to names used by docker-compose.prod.yml
# (docker-api:latest / docker-web:latest / docker-admin:latest).
# VPS never compiles Next/Nest — protects shared nginx and sibling sites.
set -euo pipefail

TAG="${DRACORD_IMAGE_TAG:?DRACORD_IMAGE_TAG required (git sha)}"
PREFIX="${DRACORD_IMAGE_PREFIX:-ghcr.io/adorratm/dracord}"
RETRIES="${DRACORD_PULL_RETRIES:-4}"
RETRY_SLEEP="${DRACORD_PULL_RETRY_SLEEP:-8}"

SERVICES=(api web admin)

echo "==> Pull prebuilt images (tag=$TAG prefix=$PREFIX retries=$RETRIES)"

pull_one() {
  local remote="$1"
  local attempt=1
  local err=0

  while (( attempt <= RETRIES )); do
    echo "    pull attempt ${attempt}/${RETRIES}: ${remote}"
    if docker pull "$remote"; then
      return 0
    fi
    err=$?
    echo "    !! pull failed (exit ${err}) — cleaning partial image / content" >&2
    docker image rm -f "$remote" 2>/dev/null || true
    # Incomplete overlayfs extracts leave bad snapshots; prune dangling only (safe with running stacks)
    docker image prune -f >/dev/null 2>&1 || true
    if (( attempt < RETRIES )); then
      echo "    sleeping ${RETRY_SLEEP}s before retry…" >&2
      sleep "$RETRY_SLEEP"
      RETRY_SLEEP=$((RETRY_SLEEP + 4))
    fi
    attempt=$((attempt + 1))
  done
  return "$err"
}

for svc in "${SERVICES[@]}"; do
  remote="${PREFIX}/${svc}:${TAG}"
  local_img="docker-${svc}"
  echo "--> $remote"
  if ! pull_one "$remote"; then
    echo "!! FATAL: could not pull $remote after ${RETRIES} attempts" >&2
    echo "   Server tip (SSH): docker image rm -f $remote; sudo systemctl restart containerd docker; re-run deploy" >&2
    echo "   Often transient: containerd overlayfs Lchown race on large node_modules layers." >&2
    exit 1
  fi
  docker tag "$remote" "${local_img}:latest"
  docker tag "$remote" "${local_img}:${TAG}"
  echo "    tagged ${local_img}:latest"
done

echo "==> Prebuilt images ready (no on-server yarn/next build)"
