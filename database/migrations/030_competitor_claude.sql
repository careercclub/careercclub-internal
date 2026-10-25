-- Putaran 45: Claude access for Competitor Intel. Competitors, products and flags Claude adds
-- through /api/agent/competitor-intel show "Added by Claude" (who and when).

alter table public.competitor_profiles add column if not exists added_via text;
alter table public.competitor_profiles add column if not exists added_at timestamptz;
alter table public.competitor_products add column if not exists added_via text;
alter table public.competitor_products add column if not exists added_at timestamptz;
alter table public.competitor_flags add column if not exists added_via text;
