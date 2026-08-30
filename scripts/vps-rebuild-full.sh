#!/usr/bin/env bash

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

compose=(docker compose -f docker-compose.production.yml)
postgres_container="${POSTGRES_CONTAINER:-deploy-postgres-1}"
postgres_user="${POSTGRES_ADMIN_USER:-ccc_user}"
postgres_database="${POSTGRES_DATABASE:-ccc_ops}"
# Migrations run as the admin role, which owns whatever it creates. The application
# connects as this role, so a table created without a matching grant is invisible to
# it — the migration succeeds and the page still returns 42501.
postgres_app_role="${POSTGRES_APP_ROLE:-ccc_ops_app}"
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

# A migration that creates a table but forgets to grant it leaves the schema correct
# and the application broken: the migration succeeds, the ledger records it, and the
# page returns 42501 "permission denied". Assert the application role can actually
# reach every table before shipping code that depends on it. Runs every deploy, not
# just when migrations applied, so a manually created table is caught too.
echo "Verifying $postgres_app_role can reach every table in public..."
"${psql_command[@]}" -v app_role="$postgres_app_role" <<'SQL'
-- Interpolated here, outside the dollar-quoted body, because psql does not expand
-- :variables inside $$ ... $$.
select set_config('ccc.app_role', :'app_role', false);

do $$
declare
  app_role text := current_setting('ccc.app_role', true);
  blocked text;
begin
  if not exists (select 1 from pg_roles where rolname = app_role) then
    raise notice 'Role % does not exist; skipping grant assertion.', app_role;
    return;
  end if;

  select string_agg(missing.relname, ', ' order by missing.relname)
  into blocked
  from (
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      -- The migration ledger is deployment infrastructure; the app never reads it.
      and c.relname <> 'app_schema_migrations'
      and not (
        has_table_privilege(app_role, c.oid, 'SELECT')
        and has_table_privilege(app_role, c.oid, 'INSERT')
        and has_table_privilege(app_role, c.oid, 'UPDATE')
        and has_table_privilege(app_role, c.oid, 'DELETE')
      )
  ) as missing;

  if blocked is not null then
    raise exception using
      message = format('%s is missing table privileges on: %s', app_role, blocked),
      hint = 'Add a migration granting select, insert, update, delete on those tables to the application role (see 020_grant_app_role_access.sql).';
  end if;

  raise notice 'Grant check passed for %.', app_role;
end
$$;
SQL

echo "Building and starting the complete Next.js application..."
"${compose[@]}" build web
"${compose[@]}" up -d --force-recreate web
deployment_complete=true
"${compose[@]}" ps

echo "Full VPS rebuild complete."
