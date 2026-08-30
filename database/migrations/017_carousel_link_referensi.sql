-- Carousel plans carry a second, independent reference URL alongside link_brief:
-- link_brief points at the written brief, link_referensi at a visual reference.
--
-- Nullable with no default and no backfill — an absent reference is a real state,
-- and the two links are never derivable from one another.

begin;

alter table public.carousel_plans
  add column if not exists link_referensi text;

commit;
