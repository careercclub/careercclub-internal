-- Putaran 44: Claude access for Customer Knowledge. Pain points Claude adds through
-- /api/agent/customer-knowledge show "Added by Claude" (who and when).

alter table public.pain_points add column if not exists added_via text;
alter table public.pain_points add column if not exists added_at timestamptz;
