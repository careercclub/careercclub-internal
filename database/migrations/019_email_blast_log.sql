-- Server-side record of every email blast.
--
-- Legacy main keeps blast history in localStorage (`ccc_blast_logs`, capped at 100),
-- which means the history and any "sent per day" figure differ on every browser and
-- vanish when someone clears their cache. The log is written by /api/send-email, so
-- it covers every surface that sends (CRM, Talent Pool, MT vacancies), not just the
-- one whose UI happens to show it.

begin;

create table if not exists public.email_blast_log (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  actor_user_id uuid references public.auth_users(id) on delete set null,
  actor_name text not null default '',
  source text not null default 'crm',
  segment text not null default '',
  subject text not null default '',
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  scheduled_at timestamptz,
  -- First few failures only; this is a history panel, not an error store.
  errors jsonb not null default '[]'::jsonb
);

-- History reads newest-first; the per-day chart groups by day over a recent window.
create index if not exists email_blast_log_sent_at_idx
  on public.email_blast_log (sent_at desc);

commit;
