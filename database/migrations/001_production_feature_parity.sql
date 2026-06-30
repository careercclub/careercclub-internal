begin;

create extension if not exists pgcrypto;

alter table if exists products
  add column if not exists type text not null default 'satuan',
  add column if not exists kategori text,
  add column if not exists harga numeric(14, 2) not null default 0,
  add column if not exists status text not null default 'Draft',
  add column if not exists deskripsi text,
  add column if not exists link text,
  add column if not exists cover_url text;

create table if not exists product_features (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null default '',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_feature_links (
  id uuid primary key default gen_random_uuid(),
  feature_id uuid not null references product_features(id) on delete cascade,
  label text not null default '',
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists product_benefits (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  nama text not null default '',
  text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_bundles (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references products(id) on delete cascade,
  item_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (bundle_id, item_id),
  check (bundle_id <> item_id)
);

create table if not exists product_klasifikasi (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists master_produk (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  klasifikasi text not null default 'Belum Diklasifikasi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sub_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  harga numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sub_product_links (
  id uuid primary key default gen_random_uuid(),
  sub_product_id uuid not null references sub_products(id) on delete cascade,
  label text not null default '',
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists event_rundown (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  waktu time,
  durasi integer not null default 0 check (durasi >= 0),
  activity text not null default '',
  keterangan text not null default '',
  link text not null default '',
  cue_mc text not null default '',
  urutan integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists story_plan_dates (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null unique,
  status text not null default 'Draft' check (status in ('Draft', 'Done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists story_plan_items (
  id uuid primary key default gen_random_uuid(),
  date_id uuid not null references story_plan_dates(id) on delete cascade,
  urutan integer not null default 0,
  isi text not null default '',
  thumbnail_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists story_plan_links (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists carousel_cta_options (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists carousel_plans (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  tanggal_posting date,
  funnel text not null default 'TOFU',
  cta text,
  assignee_id uuid,
  status text not null default 'Draft' check (status in ('Draft', 'Done')),
  link_brief text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists carousel_plan_links (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references carousel_plans(id) on delete cascade,
  label text not null default '',
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists kol_list (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  username text,
  platform text,
  niche text,
  followers integer not null default 0,
  engagement_rate numeric(8, 4),
  contact text,
  rate_card_url text,
  foto_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mt_story_list (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  perusahaan text,
  batch text,
  wa text,
  deskripsi text,
  ig_url text,
  linkedin_url text,
  brief_url text,
  foto_url text,
  is_posted boolean not null default false,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists talent_pool (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  email text unique,
  wa text,
  status text,
  sumber text,
  domisili text,
  universitas text,
  campus_tier text,
  fakultas text,
  pendidikan text,
  ipk text,
  angkatan text,
  tahun_lulus text,
  organisasi text,
  exchange text,
  relocate text,
  topik_minat text,
  target_mt text,
  posisi_mt text,
  pipeline text,
  produk_dibeli text,
  feedback text,
  linkedin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists collaborators (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  tipe text not null check (tipe in ('collaborator', 'advisor')),
  rekening text,
  privy boolean not null default false,
  kewajiban jsonb not null default '[]'::jsonb,
  services jsonb not null default '[]'::jsonb,
  background text,
  status text,
  catatan text,
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists tickets
  add column if not exists assigned_to_ids uuid[] not null default '{}',
  add column if not exists gcal_added boolean not null default false;

create index if not exists product_features_product_id_idx on product_features(product_id);
create index if not exists product_benefits_product_id_idx on product_benefits(product_id);
create index if not exists sub_products_product_id_idx on sub_products(product_id);
create index if not exists event_rundown_event_order_idx on event_rundown(event_id, urutan);
create index if not exists story_plan_items_date_order_idx on story_plan_items(date_id, urutan);
create index if not exists carousel_plans_date_idx on carousel_plans(tanggal_posting);
create index if not exists talent_pool_email_lower_idx on talent_pool(lower(email));
create index if not exists talent_pool_wa_digits_idx on talent_pool(regexp_replace(coalesce(wa, ''), '\\D', '', 'g'));
create index if not exists collaborators_type_idx on collaborators(tipe);

commit;
