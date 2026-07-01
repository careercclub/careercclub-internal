#!/usr/bin/env bash

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

compose=(docker compose -f docker-compose.production.yml)
postgres_container="${POSTGRES_CONTAINER:-deploy-postgres-1}"
postgres_user="${POSTGRES_ADMIN_USER:-ccc_user}"
postgres_database="${POSTGRES_DATABASE:-ccc_ops}"
migrations=(
  009_product_knowledge_parity.sql
  010_instagram_baseline_parity.sql
  011_program_post_event_parity.sql
)

echo "Stopping the Next.js service before database changes..."
"${compose[@]}" stop web

for migration in "${migrations[@]}"; do
  path="database/migrations/$migration"
  if [[ ! -f "$path" ]]; then
    echo "Missing migration: $path" >&2
    exit 1
  fi

  echo "Applying $migration..."
  docker exec -i "$postgres_container" \
    psql -U "$postgres_user" -d "$postgres_database" -v ON_ERROR_STOP=1 \
    < "$path"
done

echo "Building and starting the complete Next.js application..."
"${compose[@]}" build web
"${compose[@]}" up -d --force-recreate web
"${compose[@]}" ps

echo "Full VPS rebuild complete."
