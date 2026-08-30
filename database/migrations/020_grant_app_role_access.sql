-- Grants the application role access to every table in public, and sets default
-- privileges so tables created by later migrations are covered automatically.
--
-- Migrations run as the admin role (ccc_user), which owns whatever it creates. The
-- application connects as ccc_ops_app, so a newly created table is unreadable to it
-- until it is granted. Migrations 006, 009, 010 and 011 each remembered to do this
-- per table; 013 (the five competitor_intel tables) and 019 (email_blast_log) did
-- not — which is why /crm returned 42501 "permission denied for table
-- email_blast_log", and why Competitor Intel would have failed the same way.
--
-- The `alter default privileges` statements are the part that stops this recurring:
-- from here on, a table created in public by this role is granted to ccc_ops_app at
-- creation time, so a future migration cannot reintroduce the same gap by omission.
--
-- Guarded on the role existing, so this is a no-op on a local database that has no
-- separate application role.

begin;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'ccc_ops_app') then
    execute 'grant usage on schema public to ccc_ops_app';
    execute 'grant select, insert, update, delete on all tables in schema public to ccc_ops_app';
    execute 'grant usage, select on all sequences in schema public to ccc_ops_app';
    execute 'alter default privileges in schema public grant select, insert, update, delete on tables to ccc_ops_app';
    execute 'alter default privileges in schema public grant usage, select on sequences to ccc_ops_app';
  end if;
end
$$;

commit;
