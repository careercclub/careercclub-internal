-- Putaran 57: ticket notifications go to the people who can see the ticket, not to a role.
--
-- Until now a notification was stored with target_roles = the role of whoever made the ticket,
-- and every account with that role saw it (in the app and on the phone) — including staff who
-- are not allowed to open that ticket, so its title reached people outside it, while an assignee
-- with another role got nothing. From now on the app stores the exact accounts
-- (target_user_ids): everyone who may see the ticket by the board's own rule
-- (lib/tickets/visibility.ts), except the person who made the change. Older notifications keep
-- working through target_roles.
--
-- Also: accounts added since migration 018 get their ticket person (the same rule as 018), so
-- they can see their tickets and be assigned. New accounts get one when they are added.

alter table public.ticket_notifications add column if not exists target_user_ids uuid[];
create index if not exists ticket_notifications_target_user_ids_idx on public.ticket_notifications using gin (target_user_ids);

update public.tkt_people p
set auth_user_id = u.id
from public.auth_users u
where p.auth_user_id is null
  and nullif(trim(p.email), '') is not null
  and lower(trim(p.email)) = lower(trim(u.email))
  and not exists (select 1 from public.tkt_people linked where linked.auth_user_id = u.id)
  and p.id = (
    select p2.id from public.tkt_people p2
    where lower(trim(p2.email)) = lower(trim(u.email)) and p2.auth_user_id is null
    order by p2.id limit 1
  );

insert into public.tkt_people (nama, email, level, auth_user_id)
select
  coalesce(nullif(trim(u.name), ''), split_part(u.email, '@', 1)),
  lower(trim(u.email)),
  case lower(coalesce(u.role, '')) when 'admin' then 'admin' when 'lead' then 'lead' else 'staff' end,
  u.id
from public.auth_users u
where coalesce(u.is_active, true)
  and not exists (select 1 from public.tkt_people p where p.auth_user_id = u.id);
