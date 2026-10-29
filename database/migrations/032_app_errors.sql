-- Putaran 58: server errors the team can see (Settings → Errors, admins only).
--
-- Until now an unexpected error was only written to the server log, which nobody reads, so a
-- broken page or save could go unnoticed for days. The app now keeps one row per kind of error
-- (same place + same message = same row, with a count and when it last happened). Emails in a
-- message are masked before it is stored. Rows are never needed by the app itself: the table
-- can be emptied at any time.

create table if not exists public.app_errors (
  id bigserial primary key,
  fingerprint text not null unique,
  kind text not null,          -- page, api, action, job
  place text not null,         -- route or action name
  message text not null,
  digest text,
  count integer not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  fixed_at timestamptz
);

create index if not exists app_errors_last_at_idx on public.app_errors (last_at desc);
