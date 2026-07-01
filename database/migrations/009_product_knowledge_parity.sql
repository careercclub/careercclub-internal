begin;

create extension if not exists pgcrypto;

create table if not exists product_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  nama text not null default '',
  tipe text not null default 'Link',
  url text not null default '',
  status text not null default 'Draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_feedbacks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  tipe text not null default 'Improvement',
  isi text not null default '',
  tanggal text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_assets_product_id_idx on product_assets(product_id);
create index if not exists product_feedbacks_product_id_idx on product_feedbacks(product_id);

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'ccc_ops_app') then
    grant select, insert, update, delete on product_assets, product_feedbacks to ccc_ops_app;
  end if;
end $$;

commit;
