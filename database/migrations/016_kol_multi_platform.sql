-- Aligns kol_list with the multi-platform contract production has used since the
-- legacy app split Instagram and TikTok into independent identities.
--
-- kol_list can be in either of two shapes on a given database:
--   * created by 001 with the generic single-platform columns, or
--   * restored from Supabase with the legacy multi-platform columns — 001 uses
--     `create table if not exists`, so it silently skipped an already-restored table.
-- Every column is therefore added defensively before any backfill reads it, which
-- also keeps this migration safe to re-run.
--
-- Generic columns are deliberately NOT dropped: they still hold the only copy of
-- `contact` and are the backfill source. Drop them in a later migration once the
-- multi-platform columns are verified against production rows.

begin;

-- Generic single-platform model (present when the table came from migration 001).
alter table public.kol_list
  add column if not exists username text,
  add column if not exists platform text,
  add column if not exists followers integer not null default 0,
  add column if not exists engagement_rate numeric(8, 4),
  add column if not exists contact text,
  add column if not exists rate_card_url text,
  add column if not exists notes text,
  add column if not exists foto_url text;

-- Multi-platform model (present when the table was restored from Supabase).
-- link_ig / link_tiktok are legacy profile-URL overrides: the legacy card prefers
-- them over a username-derived link, and older rows still carry them.
alter table public.kol_list
  add column if not exists username_ig text,
  add column if not exists followers_ig integer,
  add column if not exists username_tiktok text,
  add column if not exists followers_tiktok integer,
  add column if not exists link_ig text,
  add column if not exists link_tiktok text,
  add column if not exists linkedin_url text,
  add column if not exists rate_card_text text,
  add column if not exists rate_card_file_url text,
  add column if not exists catatan text;

-- Backfill multi-platform columns from the generic model. Every statement no-ops on a
-- Supabase-restored table, where the generic columns exist but are entirely null.
update public.kol_list
set username_ig = nullif(trim(username), '')
where username_ig is null
  and lower(coalesce(platform, '')) = 'instagram';

update public.kol_list
set followers_ig = followers
where followers_ig is null
  and followers > 0
  and lower(coalesce(platform, '')) = 'instagram';

update public.kol_list
set username_tiktok = nullif(trim(username), '')
where username_tiktok is null
  and lower(coalesce(platform, '')) = 'tiktok';

update public.kol_list
set followers_tiktok = followers
where followers_tiktok is null
  and followers > 0
  and lower(coalesce(platform, '')) = 'tiktok';

-- The generic model stored a bare handle; the legacy model stores a full URL.
update public.kol_list
set linkedin_url = case
  when trim(username) ilike 'http%' then trim(username)
  else 'https://linkedin.com/in/' || trim(username)
end
where nullif(trim(coalesce(linkedin_url, '')), '') is null
  and nullif(trim(username), '') is not null
  and lower(coalesce(platform, '')) = 'linkedin';

update public.kol_list
set catatan = notes
where nullif(trim(coalesce(catatan, '')), '') is null
  and nullif(trim(coalesce(notes, '')), '') is not null;

-- Same R2 object key, different column name — copied verbatim, never rewritten.
update public.kol_list
set rate_card_file_url = rate_card_url
where nullif(trim(coalesce(rate_card_file_url, '')), '') is null
  and nullif(trim(coalesce(rate_card_url, '')), '') is not null;

commit;
