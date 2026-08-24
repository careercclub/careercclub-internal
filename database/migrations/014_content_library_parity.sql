begin;

alter table public.content_library
  add column if not exists tipe text;

update public.content_library
set tipe = 'organic'
where tipe is null
   or tipe not in ('organic', 'ads');

alter table public.content_library
  alter column tipe set default 'organic',
  alter column tipe set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_library_tipe_check'
      and conrelid = 'public.content_library'::regclass
  ) then
    alter table public.content_library
      add constraint content_library_tipe_check
      check (tipe in ('organic', 'ads'));
  end if;
end
$$;

create index if not exists content_library_tipe_created_idx
  on public.content_library (tipe, created_at desc);

commit;
