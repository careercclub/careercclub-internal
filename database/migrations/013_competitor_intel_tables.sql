begin;

create extension if not exists pgcrypto;

-- These tables predate the tracked migration history (part of the original Supabase
-- schema). `competitor_flags` was missing from the production restore, causing
-- `/competitor-intel` to 500 with "relation \"competitor_flags\" does not exist".
-- All statements are idempotent so this is safe to run even where a table already exists.

create table if not exists competitor_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  category text,
  platforms jsonb not null default '[]'::jsonb,
  primary_url text,
  niche text,
  target_audience text,
  followers jsonb not null default '{}'::jsonb,
  threat_level text,
  logo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitor_profiles(id) on delete cascade,
  snapshot_date date not null,
  threat_level text,
  followers jsonb not null default '{}'::jsonb,
  ads_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists competitor_flags (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitor_profiles(id) on delete cascade,
  flag_type text not null default 'other',
  flag_date date not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists competitor_products (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitor_profiles(id) on delete cascade,
  name text not null default '',
  category text,
  description text,
  price_min numeric(14, 2),
  price_max numeric(14, 2),
  status text,
  features jsonb not null default '[]'::jsonb,
  links jsonb not null default '[]'::jsonb,
  image_url text,
  image_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists competitor_product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references competitor_products(id) on delete cascade,
  price_min numeric(14, 2),
  price_max numeric(14, 2),
  recorded_at date not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists competitor_snapshots_competitor_idx on competitor_snapshots(competitor_id);
create index if not exists competitor_flags_competitor_idx on competitor_flags(competitor_id);
create index if not exists competitor_products_competitor_idx on competitor_products(competitor_id);
create index if not exists competitor_product_prices_product_idx on competitor_product_prices(product_id);

commit;
