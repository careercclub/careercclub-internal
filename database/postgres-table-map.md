# Postgres Table Map

The app no longer imports Supabase client code. Server-side data access goes through
`lib/db/postgres.ts` and module-specific files under `lib/api/`.

Set `DATABASE_URL` or `POSTGRES_URL` in the environment. Existing Supabase tables can be
restored into Postgres with the same table names, then wired module by module.

| Module API | Expected Postgres tables |
| --- | --- |
| `lib/api/auth-users.ts` | `auth_users` |
| `lib/api/dashboard.ts` | `activity_log`, `events`, `tasks`, `crm_deals`, `tickets`, `content_library` |
| `lib/api/content-planning.ts` | `content_plans` |
| `lib/api/content-evaluation.ts` | `content_evaluations` |
| `lib/api/meta-ads.ts` | `ads_contents` |
| `lib/api/instagram.ts` | `ig_snapshots`, `ig_targets` |
| `lib/api/content-library.ts` | `content_library` |
| `lib/api/voucher.ts` | `vouchers` |
| `lib/api/program.ts` | `events`, `tasks`, `event_link_templates` |
| `lib/api/products.ts` | `products`, `product_pain_points`, `product_passion_points` |
| `lib/api/crm.ts` | `buyers`, `crm_deals` |
| `lib/api/job-vacancy-mt.ts` | `mt_vacancies`, `mt_industries` |
| `lib/api/competitor-intel.ts` | `competitor_profiles`, `competitor_snapshots`, `competitor_flags`, `competitor_products`, `competitor_product_prices` |
| `lib/api/customer-knowledge.ts` | `pain_points`, `pain_point_platforms`, `pain_point_categories`, `free_class_eval` |
| `lib/api/tickets.ts` | `tickets`, `tkt_divisi`, `tkt_people`, `tkt_types` |
| `lib/api/b2b-partnership.ts` | `partners`, `partner_deals`, `partner_outreach` |
| `lib/api/org-partnership.ts` | `org_partners`, `org_deals`, `org_outreach` |
| `lib/api/design-assets.ts` | `design_assets` |
| `lib/api/resources.ts` | `resources` |
| `lib/api/settings.ts` | `app_settings` |

Storage buckets from Supabase, such as `design-assets` and `task-attachments`, still need a
separate file-storage decision. The Postgres layer only replaces database table access.

## Authentication Table

Credentials auth expects an `auth_users` table with a bcrypt password hash:

```sql
create extension if not exists pgcrypto;

create table if not exists auth_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  password_hash text not null,
  role text default 'member',
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists auth_users_email_idx on auth_users (lower(email));
```

Generate a password hash with bcrypt before inserting a user. The optional `AUTH_ADMIN_EMAIL` and
`AUTH_ADMIN_PASSWORD` environment variables can be used as a temporary bootstrap login.
