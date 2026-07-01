begin;

alter table if exists talent_pool
  add column if not exists kepuasan text,
  add column if not exists membantu text,
  add column if not exists nps text,
  add column if not exists kode_voucher text;

commit;
