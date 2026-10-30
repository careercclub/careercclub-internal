-- Putaran 62: the CareerCclub connector for Claude (a remote MCP server at /api/mcp).
--
-- A person adds the connector in Claude, signs in here with their own account and agrees; Claude
-- then reads and adds data as that person, with that person's rights. Only hashes of codes and
-- tokens are stored. Admins see and disconnect connections in Settings → Claude access.

create table if not exists public.oauth_clients (
  client_id text primary key,
  client_name text not null default '',
  redirect_uris text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.oauth_codes (
  code_hash text primary key,
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  user_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  user_id text not null,
  user_label text not null default '',
  -- The sign-in code this connection came from: a code used twice ends the connection.
  code_hash text,
  access_hash text not null unique,
  refresh_hash text not null unique,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists oauth_tokens_user_idx on public.oauth_tokens (user_id);
create index if not exists oauth_clients_created_idx on public.oauth_clients (created_at);
