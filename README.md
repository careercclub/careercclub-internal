# CareerCclub Internal Ops

Fresh TypeScript Next.js App Router scaffold for the CCC internal dashboard.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## App Routes

The old single-page sidebar modules are now split across explicit App Router segments:

- `/` redirects to `/dashboard`
- `/dashboard`
- `/content-planning`
- `/content-evaluation`
- `/meta-ads`
- `/instagram`
- `/content-library`
- `/voucher`
- `/program`
- `/products`
- `/crm`
- `/job-vacancy-mt`
- `/competitor-intel`
- `/customer-knowledge`
- `/tickets`
- `/b2b-partnership`
- `/org-partnership`
- `/design-assets`
- `/resources`
- `/settings`
- `/talent-pool`
- `/collaborators`
- nested Product, Content Planning, and Program feature routes
- `/api/send-email` typed Resend proxy route
- `/api/storage` authenticated R2 presigning route
- `/api/ai/parse` and `/api/ai/parse-screenshot` authenticated Anthropic routes

## Postgres Data Layer

Set one of these environment variables:

```bash
DATABASE_URL=postgres://user:password@host:5432/database
# or
POSTGRES_URL=postgres://user:password@host:5432/database
```

Postgres connection code is in `lib/db/postgres.ts`. Query helpers are in `lib/db/query.ts`.

Module APIs are intentionally split by feature under `lib/api/`, for example:

- `lib/api/crm.ts`
- `lib/api/program.ts`
- `lib/api/tickets.ts`
- `lib/api/customer-knowledge.ts`
- `lib/api/b2b-partnership.ts`

There is no `lib/api.ts` monolith. See `database/postgres-table-map.md` for the table names each module expects after migrating from Supabase.

## Authentication

Auth.js / NextAuth is configured with the App Router route handler at `app/api/auth/[...nextauth]/route.ts`.
Set these variables:

```bash
AUTH_SECRET=your_generated_secret
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
```

Credentials sign-in reads internal users from the `auth_users` Postgres table. For first-run access
while the table is empty, set:

```bash
AUTH_ADMIN_EMAIL=admin@careercclub.com
AUTH_ADMIN_PASSWORD=change-me
```

Route protection lives in `auth.config.ts` and the Next.js 16 `proxy.ts`; server-only credential
verification stays in `auth.ts` and `lib/api/auth-users.ts`.

## Email API

`POST /api/send-email` proxies email sends to Resend. Configure:

```bash
RESEND_API_KEY=your_resend_key
RESEND_FROM_EMAIL=onboarding@resend.dev
```

Payload:

```json
{
  "to": "member@example.com",
  "subject": "Hello",
  "html": "<p>Email body</p>",
  "from_name": "CareerCclub"
}
```

## Database Migrations

Restore the Supabase PostgreSQL dump to staging on the VPS first, then apply the committed SQL in
order:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_production_feature_parity.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/002_crm_buyer_matching.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/003_normalize_r2_storage_keys.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/004_ticket_notifications_and_pwa.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/005_workflow_integrity.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/006_app_settings.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/007_parity_contract_corrections.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/008_talent_pool_parity.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/009_product_knowledge_parity.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/010_instagram_baseline_parity.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/011_program_post_event_parity.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/012_normalize_legacy_gallery_keys.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/013_competitor_intel_tables.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/014_content_library_parity.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/015_google_calendar_event_sync.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/016_kol_multi_platform.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/017_carousel_link_referensi.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/018_ticket_assignee_auth_user.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/019_email_blast_log.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/020_grant_app_role_access.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/021_restore_upsert_constraints.sql
```

A migration that creates a table must grant it to the application role. `020` sets
default privileges so this now happens automatically, but check `\dp` after adding a
table if the app reports `permission denied` (SQLSTATE 42501).

Do not point production at the new VPS database until row counts, foreign keys, CRM buyer counts,
and sampled records match the Supabase source.

## Cloudflare R2

Create one private bucket and configure the R2 variables from `.env.example`. The app creates
short-lived S3-compatible PUT URLs through `/api/storage`; browsers upload directly to R2 and the
database stores only the resulting object key.

The bucket must allow `PUT` from the deployed application origin. A minimal R2 CORS policy is:

```json
[
  {
    "AllowedOrigins": ["https://internal.ccclub.id"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Ticket Notifications And PWA

Ticket create, update, and delete actions publish notifications to the roles selected on the
ticket. Visibility and read receipts are enforced server-side per authenticated PostgreSQL user.
Users can optionally enable Web Push from the notification panel after VAPID credentials are set.

The PWA service worker caches only immutable static assets and the offline page. Authenticated HTML
and API responses remain network-only so another user cannot receive stale operational data from a
shared browser cache.

## Production Deployment

The primary production deployment is a standalone Next.js container on the VPS, connected to the
existing PostgreSQL container through the external `deploy_default` network. See
`DEPLOYMENT_VPS.md` for the Compose, Caddy, DNS, and verification procedure.

This application cannot use a pure `output: "export"` build: Auth.js, Server Actions, PostgreSQL,
Resend, Anthropic, and R2 presigning require a server runtime. OpenNext Worker configuration remains
available as an alternative, but production `internal.ccclub.id` is owned by VPS Caddy and must not
also be configured as a Worker Custom Domain.

### Alternative Cloudflare Worker Deployment

1. Create a Cloudflare Tunnel TCP hostname for the TLS-enabled VPS PostgreSQL service.
2. Create a private Hyperdrive configuration for database `ccc_ops` using role `ccc_ops_app`.
3. Add the returned ID as the `HYPERDRIVE` binding in `wrangler.jsonc`.
4. Apply `r2-cors.json` to the `ccc-ops` bucket.
5. Add application secrets with `npx wrangler secret put NAME`.
6. Run `npm run build:cloudflare`, then `npm run deploy`.

Required Worker secrets include `AUTH_SECRET`, `ANTHROPIC_API_KEY`, Resend values, and R2 S3 API
credentials. `DATABASE_URL` is only needed for local development; deployed database traffic uses
the Hyperdrive binding. Keep PostgreSQL restricted by firewall/TLS or connect Hyperdrive through
Cloudflare Tunnel when the database has no public address.
