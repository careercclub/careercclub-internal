-- Closes the gaps the deploy-time schema check reported.
--
-- Same root cause as 022: migration 001 uses `create table if not exists`, and the
-- Supabase dump was restored first, so for every table the dump already had, 001's
-- column declarations never ran. 013 created the competitor_intel tables but its
-- column set has since diverged from what the record catalog declares.
--
-- Column list comes verbatim from the schema check's own output, so this is the
-- complete set rather than another single-symptom patch.

begin;

alter table public.carousel_plan_links
  add column if not exists plan_id uuid references public.carousel_plans(id) on delete cascade;

alter table public.competitor_products
  add column if not exists name text,
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists features text,
  add column if not exists price_min numeric,
  add column if not exists price_max numeric,
  add column if not exists status text;

alter table public.competitor_product_prices
  add column if not exists price_min numeric,
  add column if not exists price_max numeric,
  add column if not exists notes text;

alter table public.content_evaluations
  add column if not exists thumbnail_url text;

alter table public.crm_deals
  add column if not exists produk_target text,
  add column if not exists klas_target text,
  add column if not exists harga_target numeric,
  add column if not exists tipe text,
  add column if not exists tanggal date,
  add column if not exists catatan text;

alter table public.story_plan_items
  add column if not exists thumbnail_key text;

commit;
