-- Dump-only tables (not created by any migration), shaped after the legacy Supabase app.
create extension if not exists pgcrypto;
create table buyers (id uuid primary key default gen_random_uuid());
create table content_evaluations (
  id uuid primary key default gen_random_uuid(), post_id text, account_id text, account_username text, description text,
  judul text default '', url text default '', format text default 'Carousel', tanggal date, topik text default '',
  followers numeric, views numeric, reach numeric, nf_pct numeric, from_home numeric, from_profile numeric, from_other numeric,
  likes numeric, comments numeric, saves numeric, shares numeric, engaged numeric, profile_visits numeric, follows numeric, link_taps numeric,
  watchtime numeric, wtr numeric, duration numeric, replays numeric, dropoff numeric, taps_forward numeric, taps_back numeric, exits numeric,
  replies numeric, stickers_interact numeric, hook_rating numeric, cta_eff text default '', win text default '', improve text default '', action text default '',
  created_at timestamptz default now());
create table ig_snapshots (id uuid primary key default gen_random_uuid(), week_start date not null, followers_total integer default 0, follows_gained integer default 0,
  reach integer default 0, views integer default 0, interactions integer default 0, link_clicks integer default 0, profile_visits integer default 0, notes text default '', created_at timestamptz default now());
create table mt_vacancies (id uuid primary key default gen_random_uuid(), company text, program text, industry text, roles jsonb default '[]', selection text,
  links jsonb default '[]', deadline date, status text default 'Active', notes text, input_date date, gpa text, edu text, majors jsonb default '[]', placement jsonb default '[]',
  other_req text, duration text, months jsonb default '[]', year text, open_date date, career_links jsonb default '[]', ref_links jsonb default '[]', created_at timestamptz default now());
create table mt_industries (id uuid primary key default gen_random_uuid(), nama text);
create table free_class_eval (id uuid primary key default gen_random_uuid(), email text, seri text, nama text, universitas text, angkatan text, timestamp text,
  materi_judul numeric, materi_kebutuhan numeric, materi_mudah numeric, materi_jawab numeric, nara_kuasai numeric, nara_jelas numeric, kualitas_teknis numeric, waktu numeric,
  moderator numeric, info_webinar numeric, kepuasan numeric, minat numeric, rekomendasi numeric, hal_baik text, ditingkatkan text, topik_keinginan text, created_at timestamptz default now());
create or replace function ccc_normalize_wa(raw_value text)
returns text
language plpgsql
immutable
as $$
declare
  trimmed_value text := btrim(coalesce(raw_value, ''));
  digits text := regexp_replace(btrim(coalesce(raw_value, '')), '\D', '', 'g');
begin
  if digits = '' then
    return '';
  end if;

  if left(trimmed_value, 1) = '+' and left(trimmed_value, 3) <> '+62' then
    return digits;
  end if;

  if left(digits, 1) = '0' then
    return '62' || substring(digits from 2);
  end if;

  if left(digits, 2) <> '62' then
    return '62' || digits;
  end if;

  return digits;
end;
$$;
create table if not exists master_produk (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  klasifikasi text not null default 'Belum Diklasifikasi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists talent_pool (id uuid primary key default gen_random_uuid(), created_at timestamptz default now());
alter table public.buyers
  add column if not exists name text,
  add column if not exists wa text,
  add column if not exists email text,
  add column if not exists produk text,
  add column if not exists klasifikasi text,
  add column if not exists harga numeric,
  add column if not exists industri text,
  add column if not exists tahap text,
  add column if not exists sumber text,
  add column if not exists status text,
  add column if not exists payment_status text,
  add column if not exists talent_pool boolean not null default false,
  add column if not exists tanggal date,
  -- Per-buyer purchase history; the importer appends one entry per transaction.
  add column if not exists riwayat jsonb not null default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
alter table public.talent_pool
  add column if not exists nama text,
  add column if not exists email text,
  add column if not exists wa text,
  add column if not exists status text,
  add column if not exists sumber text,
  add column if not exists domisili text,
  add column if not exists universitas text,
  add column if not exists campus_tier text,
  add column if not exists fakultas text,
  add column if not exists pendidikan text,
  add column if not exists ipk text,
  add column if not exists angkatan text,
  add column if not exists tahun_lulus text,
  add column if not exists organisasi text,
  add column if not exists exchange text,
  add column if not exists relocate text,
  add column if not exists topik_minat text,
  add column if not exists target_mt text,
  add column if not exists posisi_mt text,
  add column if not exists pipeline text,
  add column if not exists produk_dibeli text,
  add column if not exists feedback text,
  add column if not exists linkedin text,
  -- Added by 008; repeated so a database that skipped it is still correct.
  add column if not exists kepuasan text,
  add column if not exists membantu text,
  add column if not exists nps text,
  add column if not exists kode_voucher text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
create unique index if not exists talent_pool_email_unique_idx on public.talent_pool (email); create unique index if not exists free_class_eval_email_seri_unique_idx on public.free_class_eval (email, seri);
