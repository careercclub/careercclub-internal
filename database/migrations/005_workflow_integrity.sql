begin;

with duplicate_ads as (
  select id,
    row_number() over (partition by eval_id order by created_at desc, id desc) as duplicate_number
  from ads_contents
  where eval_id is not null
)
delete from ads_contents
where id in (select id from duplicate_ads where duplicate_number > 1);

create unique index if not exists ads_contents_eval_id_unique_idx
  on ads_contents (eval_id)
  where eval_id is not null;

create unique index if not exists ig_targets_year_unique_idx
  on ig_targets (year);

create index if not exists tasks_ticket_id_idx on tasks (ticket_id);
create index if not exists tickets_related_task_id_idx on tickets (related_task_id);
create index if not exists tasks_project_status_due_idx on tasks (project_id, status, due_date);

commit;
