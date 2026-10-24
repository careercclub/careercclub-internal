-- Job Vacancy MT, rebuilt around the MT prospect workbook (Putaran 31).
--
-- The module used to keep a hand-entered list of vacancies (mt_vacancies) and an
-- industry master (mt_industries). It now tracks the companies that run management
-- trainee programmes, as researched in the "CCC List MT" workbook: when each company
-- opened its programme in 2024–2026, its HR contacts, the programme requirements,
-- dated status updates and selection steps.
--
-- The owner asked for the old vacancy data to be removed permanently, so both old
-- tables are dropped. This cannot be undone; take a dump first if a copy is wanted:
--   pg_dump -t mt_vacancies -t mt_industries ...
--
-- Rows from the workbook carry source = 'import' and an import_key, so uploading a
-- newer workbook updates them in place. Companies and contacts added in the app carry
-- source = 'manual' and are never touched by an upload.

begin;

create extension if not exists pgcrypto;

drop table if exists public.mt_vacancies;
drop table if exists public.mt_industries;

create table if not exists public.mt_prospects (
  id uuid primary key default gen_random_uuid(),
  -- Stable key of a workbook row (legal name | brand | occurrence); null when added in the app.
  import_key text unique,
  legal_name text not null default '',
  brand text not null default '',
  -- active = opening MT in the current year; predicted = opened last year, expected again;
  -- older = only seen in earlier years; excluded = taken off the active list (kept for reference).
  status text not null default 'active' check (status in ('active', 'predicted', 'older', 'excluded')),
  industry text not null default '',
  program text not null default '',
  active_years text not null default '',
  total_openings integer,
  -- Months (1–12) the company's subscription / usual hiring falls in.
  usual_months integer[] not null default '{}',
  -- { "2026": { "months": [5, 6], "label": "Mei–Juni", "dates": "8 Mei\n27 Juni" }, ... }
  openings jsonb not null default '{}'::jsonb,
  -- From the "Prediksi 2026" sheet: priority, pattern, estimate, basis, approach, confidence, notes.
  prediction jsonb,
  notes text not null default '',
  exclusion_reason text not null default '',
  source text not null default 'manual' check (source in ('import', 'manual')),
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mt_prospects_status_idx on public.mt_prospects (status);

create table if not exists public.mt_prospect_contacts (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.mt_prospects (id) on delete cascade,
  name text not null default '',
  title text not null default '',
  -- A LinkedIn profile, or an email address for a general recruitment inbox.
  link text not null default '',
  mt_status text not null default '',
  source text not null default 'manual' check (source in ('import', 'manual')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mt_prospect_contacts_prospect_idx on public.mt_prospect_contacts (prospect_id);

-- Research rows shown on a company: requirements ("Syarat Gabungan"), dated status
-- updates ("Update Tgl & Status") and selection steps ("Tahapan Tambahan").
create table if not exists public.mt_prospect_research (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.mt_prospects (id) on delete cascade,
  kind text not null check (kind in ('requirement', 'update', 'steps')),
  program text not null default '',
  origin text not null default '',
  ref_id text not null default '',
  details jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists mt_prospect_research_prospect_idx on public.mt_prospect_research (prospect_id, kind);

-- One row per workbook upload: shown as "Data from <file> · <date>" and kept as history.
create table if not exists public.mt_prospect_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null default '',
  imported_by text not null default '',
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'ccc_ops_app') then
    execute 'grant select, insert, update, delete on public.mt_prospects, public.mt_prospect_contacts, public.mt_prospect_research, public.mt_prospect_imports to ccc_ops_app';
  end if;
end
$$;

commit;
