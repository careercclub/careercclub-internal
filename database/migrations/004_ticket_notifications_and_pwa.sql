begin;

alter table if exists tickets
  add column if not exists notification_roles text[] not null default array['admin']::text[];

update tickets
set notification_roles = array['admin']::text[]
where notification_roles is null or cardinality(notification_roles) = 0;

create table if not exists ticket_notifications (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id) on delete set null,
  actor_user_id uuid references auth_users(id) on delete set null,
  actor_name text not null,
  event_type text not null check (event_type in ('created', 'updated', 'deleted')),
  title text not null,
  message text not null,
  target_roles text[] not null check (cardinality(target_roles) > 0),
  created_at timestamptz not null default now()
);

create table if not exists ticket_notification_reads (
  notification_id uuid not null references ticket_notifications(id) on delete cascade,
  user_id uuid not null references auth_users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table if not exists web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth_users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_notification_roles_idx
  on tickets using gin (notification_roles);

create index if not exists ticket_notifications_created_at_idx
  on ticket_notifications (created_at desc);

create index if not exists ticket_notifications_target_roles_idx
  on ticket_notifications using gin (target_roles);

create index if not exists ticket_notification_reads_user_idx
  on ticket_notification_reads (user_id, read_at desc);

create index if not exists web_push_subscriptions_user_idx
  on web_push_subscriptions (user_id);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'ccc_ops_app') then
    execute 'grant select, insert, update, delete on ticket_notifications to ccc_ops_app';
    execute 'grant select, insert, update, delete on ticket_notification_reads to ccc_ops_app';
    execute 'grant select, insert, update, delete on web_push_subscriptions to ccc_ops_app';
  end if;
end;
$$;

commit;
