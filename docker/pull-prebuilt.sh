#!/usr/bin/env bash
# Pull CI-built images from GHCR and retag to names used by docker-compose.prod.yml
# (docker-api:latest / docker-web:latest / docker-admin:latest).
# VPS never compiles Next/Nest — protects shared nginx and sibling sites.
set -euo pipefail

TAG="${DRACORD_IMAGE_TAG:?DRACORD_IMAGE_TAG required (git sha)}"
PREFIX="${DRACORD_IMAGE_PREFIX:-ghcr.io/adorratm/dracord}"

SERVICES=(api web admin)

echo "==> Pull prebuilt images (tag=$TAG prefix=$PREFIX)"

for svc in "${SERVICES[@]}"; do
  remote="${PREFIX}/${svc}:${TAG}"
  local_img="docker-${svc}"
  echo "--> $remote"
  docker pull "$remote"
  docker tag "$remote" "${local_img}:latest"
  docker tag "$remote" "${local_img}:${TAG}"
  echo "    tagged ${local_img}:latest"
done

echo "==> Prebuilt images ready (no on-server yarn/next build)"
