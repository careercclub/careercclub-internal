-- Ensures every column the application writes actually exists on the tables that came
-- from the Supabase dump rather than from a migration.
--
-- `buyers` is created by NO migration — it exists only because the dump was restored.
-- Nothing has ever added a column to it, so any field the application expects that the
-- dump did not have fails at runtime with 42703 "column ... does not exist". That is
-- what broke the lynk.id CRM import on `talent_pool`.
--
-- `talent_pool` has the same shape of problem for a different reason: migration 001
-- declares it in full, but 001 uses `create table if not exists` and the dump was
-- restored first, so 001 was skipped entirely. Only the four columns added by 008 are
-- guaranteed to exist; the rest of 001's declaration never ran.
--
-- Every statement is `add column if not exists`, so this changes nothing on a database
-- where the columns are already present, and is safe to re-run. Existing columns keep
-- their current type — this only fills gaps, it never rewrites what is already there.

begin;

-- ── buyers ────────────────────────────────────────────────────────────────────
-- The full set written by lib/api/crm.ts and rendered by the CRM workspace.
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

-- ── talent_pool ───────────────────────────────────────────────────────────────
-- 001's full declaration, restated defensively because 001 itself was skipped.
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

commit;
