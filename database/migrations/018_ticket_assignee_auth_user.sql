-- Links ticket assignees to real application accounts.
--
-- Tickets store assigned_to_ids as tkt_people ids, and the app has been resolving
-- "who am I" by comparing the session email to tkt_people.email in JavaScript
-- (app/(dashboard)/tickets/page.tsx). That match is invisible when it fails: a user
-- with no matching tkt_people row sees an empty ticket board rather than an error,
-- and cannot be assigned to anything.
--
-- This makes the link explicit and guarantees every active account has exactly one
-- assignable person row. tkt_people stays the assignee entity so existing
-- assigned_to_ids, requester_id and calendar-guest emails keep resolving unchanged.

begin;

alter table public.tkt_people
  add column if not exists auth_user_id uuid references public.auth_users(id) on delete set null;

-- Adopt the email match the application was already making. Where several people
-- rows share one account's email, only the lowest id is linked so the unique index
-- below can be created.
update public.tkt_people p
set auth_user_id = u.id
from public.auth_users u
where p.auth_user_id is null
  and nullif(trim(p.email), '') is not null
  and lower(trim(p.email)) = lower(trim(u.email))
  and p.id = (
    select p2.id
    from public.tkt_people p2
    where lower(trim(p2.email)) = lower(trim(u.email))
      and p2.auth_user_id is null
    order by p2.id
    limit 1
  );

-- Give every active account a person row so it can be assigned and can see its own
-- tickets. Deactivated accounts are deliberately not given new rows — an existing
-- link is kept so their historical assignments still resolve to a name.
insert into public.tkt_people (nama, email, level, auth_user_id)
select
  coalesce(nullif(trim(u.name), ''), split_part(u.email, '@', 1)),
  lower(trim(u.email)),
  case lower(coalesce(u.role, '')) when 'admin' then 'admin' when 'lead' then 'lead' else 'staff' end,
  u.id
from public.auth_users u
where coalesce(u.is_active, true)
  and not exists (select 1 from public.tkt_people p where p.auth_user_id = u.id);

-- One person row per account. Partial so the unlinked rows (people who are not app
-- users) remain valid and assignable.
create unique index if not exists tkt_people_auth_user_id_key
  on public.tkt_people (auth_user_id)
  where auth_user_id is not null;

create index if not exists tkt_people_email_lower_idx
  on public.tkt_people (lower(email));

commit;
