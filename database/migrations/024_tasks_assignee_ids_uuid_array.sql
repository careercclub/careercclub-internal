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
-- schema check passed: it verified that columns exist, not what type they are.
--
-- Done as add / backfill / swap rather than `alter column ... type ... using (...)`,
-- because Postgres rejects a subquery in a USING transform expression ("cannot use
-- subquery in transform expression") and unpacking a jsonb array needs one.
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
      and data_type in ('jsonb', 'json')
  ) then
    alter table public.tasks
      add column if not exists assignee_ids__uuid uuid[] not null default '{}'::uuid[];

    update public.tasks as t
    set assignee_ids__uuid = coalesce((
      select array_agg((element #>> '{}')::uuid)
      from jsonb_array_elements(
        case when jsonb_typeof(t.assignee_ids::jsonb) = 'array' then t.assignee_ids::jsonb else '[]'::jsonb end
      ) as element
      -- Skip anything that is not a uuid rather than failing the whole migration on
      -- one malformed legacy row.
      where (element #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ), '{}'::uuid[]);

    alter table public.tasks drop column assignee_ids;
    alter table public.tasks rename column assignee_ids__uuid to assignee_ids;

    raise notice 'tasks.assignee_ids converted to uuid[] (% rows).', (select count(*) from public.tasks);
  else
    raise notice 'tasks.assignee_ids is already uuid[]; nothing to do.';
  end if;
end
$$;

commit;
