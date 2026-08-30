-- Restores the unique constraints that ON CONFLICT upserts depend on.
--
-- Migration 001 declares `master_produk.nama unique` and `talent_pool.email unique`,
-- but 001 uses `create table if not exists` and production restored the Supabase dump
-- first — so for every table that already existed, 001 was skipped and its constraints
-- were never created. The tables look right; the upserts fail at runtime with
-- 42P10 "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification". That is what broke the lynk.id CRM import.
--
-- free_class_eval is not created by any migration at all (it comes only from the dump),
-- so its (email, seri) upsert has the same exposure.
--
-- ads_contents is deliberately not included: migration 005 already created its partial
-- unique index, and lib/api/meta-ads.ts correctly writes
-- `on conflict (eval_id) where eval_id is not null` so the partial index can be
-- inferred. Do not "simplify" that WHERE away — a partial index cannot be inferred
-- without it.
--
-- Each block dedupes before indexing, following the pattern set by 005. ctid is used
-- as the tiebreak so no assumption is made about which columns these restored tables
-- actually have. Rows whose key is NULL are never touched: NULLs do not collide in a
-- unique index.

begin;

-- ── master_produk (nama) ──────────────────────────────────────────────────────
delete from public.master_produk a
using public.master_produk b
where a.nama = b.nama
  and a.ctid > b.ctid;

create unique index if not exists master_produk_nama_unique_idx
  on public.master_produk (nama);

-- ── talent_pool (email) ───────────────────────────────────────────────────────
-- The importer writes lowercased, trimmed emails. Aligning existing rows to the same
-- shape stops one person occupying two rows as "A@x.com" and "a@x.com", and lets the
-- dedupe below catch those pairs.
update public.talent_pool
set email = lower(btrim(email))
where email is not null
  and email <> lower(btrim(email));

-- A blank string is not an identity, and unlike NULL it would collide.
update public.talent_pool
set email = null
where email is not null
  and btrim(email) = '';

delete from public.talent_pool a
using public.talent_pool b
where a.email = b.email
  and a.ctid > b.ctid;

create unique index if not exists talent_pool_email_unique_idx
  on public.talent_pool (email);

-- ── free_class_eval (email, seri) ─────────────────────────────────────────────
do $$
begin
  if to_regclass('public.free_class_eval') is null then
    raise notice 'free_class_eval does not exist; skipping.';
    return;
  end if;

  delete from public.free_class_eval a
  using public.free_class_eval b
  where a.email = b.email
    and a.seri = b.seri
    and a.ctid > b.ctid;

  create unique index if not exists free_class_eval_email_seri_unique_idx
    on public.free_class_eval (email, seri);
end
$$;

commit;
