#!/usr/bin/env bash

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

compose=(docker compose -f docker-compose.production.yml)
postgres_container="${POSTGRES_CONTAINER:-deploy-postgres-1}"
postgres_user="${POSTGRES_ADMIN_USER:-ccc_user}"
postgres_database="${POSTGRES_DATABASE:-ccc_ops}"
psql_command=(
  docker exec -i "$postgres_container"
  psql -U "$postgres_user" -d "$postgres_database" -v ON_ERROR_STOP=1
)
web_stopped=false
deployment_complete=false

restore_web_on_failure() {
  status=$?
  if (( status != 0 )) && [[ "$web_stopped" == true && "$deployment_complete" == false ]]; then
    echo "Deployment failed; restarting the previous web container..." >&2
    "${compose[@]}" start web || true
  fi
  exit "$status"
}

trap restore_web_on_failure EXIT

mapfile -d '' migration_paths < <(
  find database/migrations -maxdepth 1 -type f -name '*.sql' -print0 | sort -z
)

if (( ${#migration_paths[@]} == 0 )); then
  echo "No migration files found in database/migrations." >&2
  exit 1
fi

echo "Ensuring the migration ledger exists..."
"${psql_command[@]}" -c "
  create table if not exists public.app_schema_migrations (
    filename text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  );
"

pending_migrations=()
declare -A migration_checksums

for path in "${migration_paths[@]}"; do
  filename="$(basename "$path")"
  if [[ ! "$filename" =~ ^[0-9]{3}_[a-z0-9_]+\.sql$ ]]; then
    echo "Invalid migration filename: $filename" >&2
    exit 1
  fi

  checksum="$(sha256sum "$path" | awk '{print $1}')"
  migration_checksums["$filename"]="$checksum"
  recorded_checksum="$(
    "${psql_command[@]}" -Atc \
      "select checksum from public.app_schema_migrations where filename = '$filename';"
  )"

  if [[ -z "$recorded_checksum" ]]; then
    pending_migrations+=("$path")
  elif [[ "$recorded_checksum" != "$checksum" ]]; then
    echo "Checksum mismatch for applied migration: $filename" >&2
    echo "Create a new numbered migration instead of modifying an applied file." >&2
    exit 1
  else
    echo "Already applied: $filename"
  fi
done

if (( ${#pending_migrations[@]} > 0 )); then
  echo "Stopping the Next.js service before applying ${#pending_migrations[@]} migration(s)..."
  "${compose[@]}" stop web
  web_stopped=true

  for path in "${pending_migrations[@]}"; do
    filename="$(basename "$path")"
    checksum="${migration_checksums[$filename]}"
    echo "Applying $filename..."
    "${psql_command[@]}" < "$path"
    "${psql_command[@]}" -c "
      insert into public.app_schema_migrations (filename, checksum)
      values ('$filename', '$checksum');
    "
  done
else
  echo "No pending database migrations."
fi

echo "Building and starting the complete Next.js application..."
"${compose[@]}" build web
"${compose[@]}" up -d --force-recreate web
deployment_complete=true
"${compose[@]}" ps

echo "Full VPS rebuild complete."
