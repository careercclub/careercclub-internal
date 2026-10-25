-- Putaran 41: "Claude access" — Claude (or any agent) can add and update data through
-- /api/agent/* with a key made in Settings → Claude access. Only a SHA-256 hash of each key
-- is stored; the key itself is shown once when it is made. A key is limited to the modules
-- chosen for it, can add and update but never delete, and can be revoked at any time.

create table if not exists public.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  modules text[] not null default '{}',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- Rows added through the agent API show "Added by Claude" in the module.
alter table public.mt_prospects add column if not exists added_via text;
alter table public.mt_prospect_contacts add column if not exists added_via text;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'ccc_ops_app') then
    execute 'grant select, insert, update, delete on public.agent_tokens to ccc_ops_app';
  end if;
end
$$;
