#!/usr/bin/env bash

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

compose=(docker compose -f docker-compose.production.yml)
commit="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

echo "Deploying source commit: $commit"
echo "Building the Next.js image without database migrations or Docker cache..."
"${compose[@]}" build --pull --no-cache web
"${compose[@]}" up -d --force-recreate web
"${compose[@]}" ps

container_id="$("${compose[@]}" ps -q web)"
image_id="$(docker image inspect ccc-ops-web:latest --format '{{.Id}}')"
running_image_id="$(docker inspect "$container_id" --format '{{.Image}}')"

if [[ "$image_id" != "$running_image_id" ]]; then
  echo "The running web container does not use the image that was just built." >&2
  exit 1
fi

echo "Frontend-only VPS rebuild complete for commit $commit."
