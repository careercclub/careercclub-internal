begin;

alter table public.events add column if not exists jenis_program text;
alter table public.events add column if not exists capaian_peserta integer;
alter table public.events add column if not exists notes_post text;
alter table public.events add column if not exists links jsonb not null default '[]'::jsonb;

grant select, insert, update, delete on public.events to ccc_ops_app;

commit;
