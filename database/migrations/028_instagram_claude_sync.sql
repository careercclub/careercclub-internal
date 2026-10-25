-- Putaran 43: Claude access for Instagram & Content Evaluation. Rows Claude adds or refreshes
-- through /api/agent/instagram show who synced them and when ("Synced by Claude · 25 Oct").
-- The Meta CSV/Excel imports do not touch these columns.

alter table public.content_evaluations add column if not exists synced_by text;
alter table public.content_evaluations add column if not exists synced_at timestamptz;
alter table public.ig_snapshots add column if not exists synced_by text;
alter table public.ig_snapshots add column if not exists synced_at timestamptz;

create index if not exists content_evaluations_post_id_idx on public.content_evaluations (post_id);
