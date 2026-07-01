#!/usr/bin/env bash

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

compose=(docker compose -f docker-compose.production.yml)

echo "Building the Next.js image without running database migrations..."
"${compose[@]}" build web
"${compose[@]}" up -d --force-recreate web
"${compose[@]}" ps

echo "Frontend-only VPS rebuild complete."
