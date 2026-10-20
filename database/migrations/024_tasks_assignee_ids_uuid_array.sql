-- Converts tasks.assignee_ids from jsonb to uuid[].
--
-- The application has always treated it as a Postgres array: the record catalog
-- declares it `uuid-array`, program-actions writes `${assignees}::uuid[]`, and
-- duplicateProgramEvent writes `'{}'::uuid[]`. The sibling column
-- tickets.assigned_to_ids really is uuid[], which is why ticket writes work and task
-- writes do not. tasks came from the Supabase dump, where the column was jsonb, and no
-- migration ever reconciled the type — so every task edit failed with
-- 42804 "column assignee_ids is of type jsonb but expression is of type uuid[]".
--
-- Note this is a *type* mismatch, not a missing column, which is why the deploy-time
-- schema check passed: it verifies that columns exist, not what type they are.
--
-- Guarded on the current type, so this is a no-op on a database already holding uuid[]
-- and is safe to re-run. Reads are unaffected either way — postgres.js hands a JS array
-- to `ids()` for both representations.

begin;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'assignee_ids'
      and data_type = 'jsonb'
  ) then
    alter table public.tasks
      alter column assignee_ids drop default,
      alter column assignee_ids type uuid[] using (
        coalesce((
          select array_agg((element #>> '{}')::uuid)
          from jsonb_array_elements(
            case when jsonb_typeof(assignee_ids) = 'array' then assignee_ids else '[]'::jsonb end
          ) as element
          -- Skip anything that is not a uuid rather than failing the whole migration on
          -- one malformed legacy row.
          where (element #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ), '{}'::uuid[])
      );

    alter table public.tasks
      alter column assignee_ids set default '{}'::uuid[];

    raise notice 'tasks.assignee_ids converted from jsonb to uuid[].';
  else
    raise notice 'tasks.assignee_ids is already uuid[]; nothing to do.';
  end if;
end
$$;

commit;
