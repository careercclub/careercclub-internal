begin;

create extension if not exists pgcrypto;

create table if not exists public.ig_baselines (
  id uuid primary key default gen_random_uuid(),
  followers_total integer not null check (followers_total > 0),
  baseline_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ig_baselines add column if not exists followers_total integer;
alter table public.ig_baselines add column if not exists baseline_date date;
alter table public.ig_baselines add column if not exists created_at timestamptz default now();
alter table public.ig_baselines add column if not exists updated_at timestamptz default now();

create unique index if not exists ig_baselines_singleton_idx on public.ig_baselines ((true));

insert into public.ig_baselines (followers_total, baseline_date)
select 12042, date '2026-05-21'
where not exists (select 1 from public.ig_baselines);

grant select, insert, update, delete on public.ig_baselines to ccc_ops_app;

commit;
