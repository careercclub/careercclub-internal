begin;

alter table if exists public.tickets
  add column if not exists gcal_event_id text,
  add column if not exists gcal_event_url text;

alter table if exists public.tasks
  add column if not exists gcal_event_id text,
  add column if not exists gcal_event_url text;

commit;
