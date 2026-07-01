begin;

create extension if not exists pgcrypto;

create table if not exists app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_settings_updated_at_idx
  on app_settings (updated_at desc);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'ccc_ops_app') then
    grant select, insert, update, delete on table app_settings to ccc_ops_app;
  end if;
end
$$;

commit;
