-- How big each table is (read-only: counts and sizes only, no data). Putaran 58.
--
-- The app loads some lists whole and filters them in the browser (Talent Pool, Customer
-- Knowledge, CRM, Tickets). That is fast at today's size (tested at 2,000–3,000 rows: under a
-- second on a phone). Past roughly 10,000 rows in one of those tables, the page should switch to
-- loading one page at a time. Run this every few months, or when a page feels slow:
--   docker compose -f docker-compose.production.yml exec -T postgres psql -U ccc_user -d ccc < database/checks/table-sizes.sql

select
  c.relname as table_name,
  c.reltuples::bigint as approx_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  case when c.relname in ('talent_pool', 'buyers', 'pain_points', 'tickets', 'content_evaluations', 'free_class_eval') and c.reltuples > 10000
       then 'load page by page' else '' end as note
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc
limit 40;
