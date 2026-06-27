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
- `/api/send-email` typed Resend proxy route

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

The edge-safe route protection lives in `auth.config.ts` and `proxy.ts`; the server-only credential
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
