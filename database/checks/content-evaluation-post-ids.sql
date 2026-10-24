-- Content Evaluation rows damaged by the old Post ID bug (fixed in Putaran 27).
--
-- Until Putaran 27 the Meta CSV import read "Post ID" as a number. Instagram IDs have 17–18
-- digits, more than a JavaScript number holds exactly, so the last digits were rounded:
-- 18034567890123401 could be stored as 18034567890123400. Two different posts could round to
-- the same ID, and the import then wrote one post over the other.
--
-- A rounded ID cannot be told apart from a real one by looking at it (about 4 in 10 real IDs
-- survive the rounding unchanged). What can be told apart is the post itself: the row keeps
-- the post's permalink (url). Re-importing the original Meta CSV brings every post back with
-- its real ID, so a post that now has two rows with the same url had a rounded ID.
--
-- Run on the VPS, one step at a time, in psql:
--   docker compose -f docker-compose.production.yml exec postgres psql -U ccc_user -d ccc
-- Set the date below to the day the Putaran 27 fix (commit e39c90b) was deployed.

\set fixed_at '2026-10-24'

-- ── Step 1 (reads only): rows imported before the fix with a long Post ID ──────────
-- These went through the old reader, so their ID may be rounded. If this is 0, stop here.
select count(*) as imported_before_fix
from content_evaluations
where post_id ~ '^\d{16,}$' and created_at < :'fixed_at';

-- Posts already showing twice (same permalink) — after step 3 this is the list to fix.
select url, count(*) as rows, string_agg(post_id, ', ' order by created_at) as post_ids
from content_evaluations
where coalesce(url, '') <> ''
group by url having count(*) > 1
order by url;

-- ── Step 2: keep a copy before changing anything ────────────────────────────────
-- create table content_evaluations_backup_20261024 as table content_evaluations;

-- ── Step 3: in the app, Content Evaluation → Import Meta CSV again ──────────────
-- Upload the original Meta Business Suite CSV export(s) covering the same period. The
-- import keeps every digit now, so each post comes back with its real Post ID. Where the
-- stored ID was rounded, that is a new row next to the old one (same url); where the ID was
-- right, the existing row is simply updated. Then run step 1's second query again.

-- ── Step 4: move what was typed by hand onto the re-imported row, drop the old one ─
-- For each url with more than one row: the newest row (just re-imported, real ID) is kept;
-- older rows from before the fix are the rounded copies. Hand-filled fields move to the kept
-- row unless it already has them, then the old rows are deleted.
--
-- begin;
--
-- with ranked as (
--   select id, url, created_at, row_number() over (partition by url order by created_at desc, id) as rank
--   from content_evaluations
--   where coalesce(url, '') <> ''
-- ), pairs as (
--   select old.id as old_id, keep.id as keep_id
--   from ranked old
--   join ranked keep on keep.url = old.url and keep.rank = 1
--   where old.rank > 1 and old.created_at < :'fixed_at'
-- ), moved as (
--   update content_evaluations c set
--     topik         = coalesce(nullif(c.topik, ''), o.topik),
--     hook_rating   = coalesce(c.hook_rating, o.hook_rating),
--     cta_eff       = coalesce(nullif(c.cta_eff, ''), o.cta_eff),
--     win           = coalesce(nullif(c.win, ''), o.win),
--     improve       = coalesce(nullif(c.improve, ''), o.improve),
--     action        = coalesce(nullif(c.action, ''), o.action),
--     wtr           = coalesce(c.wtr, o.wtr),
--     thumbnail_url = coalesce(nullif(c.thumbnail_url, ''), o.thumbnail_url)
--   from pairs p join content_evaluations o on o.id = p.old_id
--   where c.id = p.keep_id
--   returning p.keep_id
-- )
-- delete from content_evaluations where id in (select old_id from pairs);
--
-- -- Should now return no rows:
-- select url, count(*) from content_evaluations where coalesce(url, '') <> '' group by url having count(*) > 1;
--
-- commit;   -- or: rollback;  if the numbers look wrong
