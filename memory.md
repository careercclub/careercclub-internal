# CareerCclub Internal Refactor Memory

This file records the completed refactor foundation, the production features discovered on the legacy branch, and the plan for fully replacing the HTML/Supabase application with Next.js and VPS-hosted PostgreSQL.

Items described as completed apply to the `refactor` branch. The current production `main` branch still runs the legacy `index.html` application against Supabase.

## Branch Comparison Snapshot

- Shared branch base: `72a7820` from 13 June 2026.
- Refactor branch: `94b7da2` (`refactor with nextjs and implement nextauth`).
- Production branch at comparison time: `ef7060f` on `main`.
- Production contains 132 commits after the shared base.
- Most production changes were added directly to `index.html`, which grew by roughly 6,900 lines.
- The branches must not be merged wholesale because that would reintroduce the single-file architecture.
- The safe integration strategy is to branch from `refactor` and port production behavior feature by feature.

## Application Foundation

- Replaced the old single-file `index.html` application with a clean Next.js 16 project.
- Converted the project to TypeScript.
- Adopted the Next.js App Router instead of keeping all modules in one page.
- Added the standard project configuration files: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.mjs`, and `eslint.config.mjs`.
- Replaced the old standalone email scripts with an App Router API route.
- Removed the obsolete `index.html`, `send-email.js`, and `api/send-email.js` implementation.

## App Router Structure

- Added a shared dashboard route group at `app/(dashboard)`.
- Added a protected dashboard layout in `app/(dashboard)/layout.tsx`.
- Added a reusable application shell with the sidebar, topbar, active navigation state, user identity, and sign-out control.
- Added shared module rendering through `app/(dashboard)/_components/module-page.tsx`.
- Centralized module navigation metadata in `app/(dashboard)/_data/navigation.ts`.
- Split the original page into these routes:
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
- Configured `/` to redirect to `/dashboard`.

## Interface Refactor

- Rebuilt the previous dashboard visual structure with React components and CSS Modules.
- Added responsive dashboard layout behavior for desktop, tablet, and mobile widths.
- Added shared module patterns for dashboards, planning boards, analytics, pipelines, galleries, tables, knowledge views, and settings.
- Added a dedicated responsive sign-in page under `app/sign-in`.
- Added authenticated user details and a sign-out button to the topbar.

## Supabase to Postgres Refactor

- Removed Supabase client imports from the application data layer.
- Added the Postgres connection module at `lib/db/postgres.ts` using the `postgres` package.
- Made Postgres client creation lazy so builds and module imports do not require an active database connection.
- Added reusable query helpers in `lib/db/query.ts` for listing, counting, reading, inserting, updating, and deleting rows.
- Added an allowlisted Postgres table registry in `lib/db/tables.ts`.
- Added reusable CRUD construction in `lib/api/_crud.ts`.
- Added support for either `DATABASE_URL` or `POSTGRES_URL`.
- Documented expected tables in `database/postgres-table-map.md`.

## Module API Refactor

- Replaced the planned monolithic `lib/api.ts` with feature-specific modules under `lib/api/`.
- Added separate APIs for:
  - Authentication users
  - Dashboard
  - Content planning
  - Content evaluation
  - Meta ads
  - Instagram
  - Content library
  - Vouchers
  - Programs
  - Products
  - CRM
  - Management trainee vacancies
  - Competitor intelligence
  - Customer knowledge
  - Tickets
  - B2B partnerships
  - Organization partnerships
  - Design assets
  - Resources
  - Settings

## Production Features To Port

The following features exist in the legacy production branch but are not yet implemented as production-ready App Router workflows.

### Products

- Product catalog redesign with product tabs and filter pills.
- Product detail and knowledge-base views.
- Product benefits, features, and feature shortlinks.
- Sub-products, prices, and sub-product shortlinks.
- Product bundles with merged knowledge-base content.
- Product classification and Lynkid master-product mapping.
- Product duplication, filtering, sorting, and JSON export.

### Tickets, Programs, and Dashboard

- Ticket calendar and redesigned ticket detail modal.
- Multiple ticket assignees through `assigned_to_ids`.
- Inline title editing, ticket duplication, links, files, comments, and CC data.
- Unified `Todo`, `In Progress`, and `Done` statuses across tickets and tasks.
- Google Calendar synchronization and `gcal_added` tracking.
- Program event rundown rows with time, duration, activity, notes, link, and MC cue.
- Automatic task-to-ticket synchronization and orphaned-task repair.
- Dashboard task/ticket chips that open detail modals.
- Dashboard drag-and-drop ticket deadline rescheduling.
- Dashboard upcoming items synchronized with the tickets table.

### Content Planning and Evaluation

- Story planning calendar, date groups, story items, links, and Draft/Done state.
- Carousel planning calendar, CTA master list, assignees, funnel, brief links, and Draft/Done state.
- KOL list with profile details, photos, rate-card upload, filters, and CRUD.
- MT Story list with company/profile details, photos, posted state, filters, and CRUD.
- Content evaluation posting calendar.
- Story-versus-buyer analysis with daily accordion, calendar, and sorting.
- Story thumbnail upload/paste support and top-story analysis.

### CRM and Talent Pool

- CRM import status handling for `PENDING`, `FAILED`, and successful transactions.
- Import-history and source filters.
- Customer grouping by WhatsApp number with all transactions shown in detail.
- CRM analytics and JSON export.
- Talent Pool page and `talent_pool` persistence.
- CRM-to-Talent-Pool matching by normalized WhatsApp number or email.

### Customer Knowledge and AI

- Screenshot upload, paste, and drag-and-drop parsing for customer pain points.
- AI extraction of comment text, platform, and pain-point category.
- Notion-style label controls and WhatsApp platform support.
- Free-text AI parsing for dashboard, tickets, partnerships, story plans, carousel plans, and vouchers.
- Anthropic API integration must be moved to authenticated Next.js route handlers.

### Collaborators

- New `/collaborators` route.
- Collaborator and Advisor tabs.
- Profile CRUD, obligations, services, notes, company/title fields, and photos.
- Search and type-specific card views.

### Additional Production Behavior

- New `/talent-pool` route.
- MT vacancy notification-detail and unread-state improvements.
- PWA pull-to-refresh fixes for iOS Safari.
- Storage bucket change from `content-photo` to `uploads`.
- UI color and compact-layout refinements from production.

## Production Data Contracts To Add

The production feature set introduced these tables that are not yet registered in the refactor data layer:

- Products: `product_features`, `product_feature_links`, `product_benefits`, `product_bundles`, `product_klasifikasi`, `master_produk`, `sub_products`, `sub_product_links`.
- Programs: `event_rundown`.
- Content planning: `story_plan_dates`, `story_plan_items`, `story_plan_links`, `carousel_plans`, `carousel_cta_options`, `carousel_plan_links`, `kol_list`, `mt_story_list`.
- CRM: `talent_pool`.
- Collaborators: `collaborators`.

Existing tables also require production schema parity. In particular, `tickets` needs `assigned_to_ids` and `gcal_added`, and ticket/task statuses must use the same normalized values.

## Supabase Usage Found In Production

- Generic browser-side CRUD through `select`, `insert`, `update`, and `delete` calls.
- Storage buckets: `uploads`, `collaborator-photos`, `design-assets`, and `task-attachments`.
- One database RPC: `count_unique_buyers`.
- No active Supabase Auth usage was found; NextAuth is already the intended replacement.
- No active Supabase Realtime subscriptions were found.
- The publishable Supabase key and database calls currently live in browser code. The migrated application must move all database access behind server-only Next.js modules.

## Authentication Refactor

- Added Auth.js / NextAuth v5 with the credentials provider.
- Added the App Router auth handler at `app/api/auth/[...nextauth]/route.ts`.
- Added server-side credential verification in `auth.ts`.
- Added an edge-safe shared auth configuration in `auth.config.ts`.
- Added route protection through Edge `middleware.ts`. Next.js 16 `proxy.ts` was replaced because its forced Node runtime is not currently supported by OpenNext Cloudflare middleware packaging.
- Added JWT-backed sessions with user ID and role fields.
- Added NextAuth TypeScript module augmentation in `types/next-auth.d.ts`.
- Added Postgres authentication through the `auth_users` table.
- Added bcrypt password verification through `bcryptjs`.
- Added support for disabling users through `is_active`.
- Added an optional environment-based bootstrap administrator using `AUTH_ADMIN_EMAIL` and `AUTH_ADMIN_PASSWORD`.
- Added authenticated dashboard layout checks in addition to proxy protection.
- Added redirect behavior for unauthenticated dashboard requests and already-authenticated sign-in requests.
- Added `AUTH_SECRET`, `AUTH_URL`, and host trust configuration documentation.

## Email API Refactor

- Replaced the old JavaScript email endpoint with `app/api/send-email/route.ts`.
- Added typed request handling and validation.
- Kept Resend as the email provider through `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

## Documentation and Configuration

- Added `.env.example` covering Postgres, Auth.js, bootstrap authentication, and Resend variables.
- Rewrote `README.md` for the Next.js routes, Postgres layer, authentication, and email API.
- Added `database/postgres-table-map.md` with module-to-table mappings and the `auth_users` schema.
- Added the `server-only` boundary to database and module API code.

## Target Architecture

- Frontend and application backend: Next.js 16 with TypeScript and App Router.
- Authentication: Auth.js / NextAuth with JWT sessions and PostgreSQL-backed credentials.
- Structured data: PostgreSQL hosted on the VPS.
- Database access: server-only `postgres` client modules under `lib/db` and feature APIs under `lib/api`.
- Mutations: authenticated Server Actions or protected App Router route handlers.
- Email: typed Resend App Router endpoint.
- AI: authenticated Anthropic App Router endpoints with request validation and server-side secrets.
- File storage: Cloudflare R2 using one private bucket with feature prefixes and short-lived presigned upload URLs. PostgreSQL stores object keys, not uploaded file bodies.
- Schema management: committed, ordered SQL migrations under `database/migrations`.
- Secrets: VPS environment variables only; no database, Resend, Anthropic, or storage credentials in client bundles.
- Database networking: PostgreSQL should not be publicly open. Restrict access with the VPS firewall, private networking where available, TLS, and a least-privileged application role.
- Backups: daily PostgreSQL backups plus VPS snapshots, with an offsite copy and a tested restore procedure.

## Refactor Implementation Progress (28 June 2026)

- Added OpenNext Cloudflare Workers configuration, Wrangler scripts, static asset binding, and a Hyperdrive-aware Postgres connection.
- Added Cloudflare R2 presigned upload/download/delete support with authenticated route handlers and direct-upload controls for product, Story, KOL, MT Story, and collaborator files.
- Added ordered PostgreSQL migrations for all 19 newly discovered production tables, ticket parity columns, CRM WhatsApp normalization, indexes, and the `count_unique_buyers()` replacement.
- Added authenticated, allowlisted Server Actions and a shared CRUD workspace backed by module-specific APIs.
- Replaced placeholders with database-backed routes for Products, product knowledge/links/bundles/classification/mapping, Story and Carousel planning, KOL, MT Story, Event Rundown, Tickets, Talent Pool, Collaborators, and Customer Knowledge pain points.
- Added CRM-to-Talent-Pool matching by normalized WhatsApp number or normalized email.
- Added authenticated Anthropic text and screenshot parsing routes. Customer Knowledge now supports screenshot choose, paste, and drag/drop parsing before saving.
- Added nested-route navigation handling and sidebar entries for Talent Pool and Collaborators.
- Protected the Resend endpoint with Auth.js and bounded request size/recipient count.

Still incomplete before production cutover:

- Rich ticket detail/calendar interactions, Google Calendar integration, and task-to-ticket synchronization/repair.
- Product duplication, merged bundle knowledge views, filtering/sorting, and JSON exports.
- Content Evaluation story-vs-buyer analytics and posting calendar.
- CRM import UI, transaction grouping/history UI, analytics, and JSON export.
- Collaborator card/search presentation and company/title schema fields still need confirmation against the production dump.
- MT vacancy unread notifications and iOS PWA pull-to-refresh behavior.
- Final application deployment, workflow smoke testing, backup automation, and monitoring.

## Complete Migration Plan

### Phase 1: Preserve Production

- Take a Supabase schema and data dump of the `public` schema.
- Export table definitions, constraints, indexes, functions, and row counts.
- Inventory every Storage object and preserve its bucket/path mapping.
- Record the production environment variables and external integrations without committing secrets.

### Phase 2: Prepare VPS Infrastructure

- Provision PostgreSQL and create separate application and migration roles.
- Configure firewall rules, TLS, backups, monitoring, and disk-capacity alerts.
- Provision Cloudflare R2 and create the `uploads`, `collaborator-photos`, `design-assets`, and `task-attachments` prefixes.
- Configure staging and production environment files outside Git.

### Phase 3: Restore and Normalize PostgreSQL

- Restore the Supabase `public` schema and data into staging PostgreSQL.
- Add ordered migrations for the 19 newly discovered production tables and changed columns.
- Replace `count_unique_buyers` with a documented SQL query or committed PostgreSQL function.
- Compare source and target row counts and validate important relationships.
- Add indexes for common filters, foreign keys, and normalized WhatsApp/email lookup.

### Phase 4: Reach Baseline Feature Parity

- Replace the generic placeholder module screens with real server-loaded data.
- Connect every existing route to its module-specific `lib/api` functions.
- Implement validated mutations, loading states, empty states, and error states.
- Preserve all production CRUD behavior before considering the refactor deployable.

### Phase 5: Port New Production Features

- Port Tickets/Programs/Dashboard first because they share status and synchronization rules.
- Port Products and all product-related tables.
- Port Content Planning, Content Evaluation, KOL, MT Story, and AI workflows.
- Port CRM and Talent Pool matching/import workflows.
- Add Collaborators and Advisor workflows.
- Port notification and PWA behavior after core data flows are stable.

### Phase 6: Remove Remaining Supabase Dependencies

- Copy Storage objects to the replacement object store.
- Update stored paths and URLs where required.
- Remove the Supabase JavaScript client, project URL, publishable key, RPC calls, and Storage calls.
- Confirm that no `supabase`, `_sb`, or Supabase environment references remain in application code.

### Phase 7: Staging and Cutover

- Run lint, type checking, production build, database integration tests, and browser workflow tests.
- Compare critical workflows against the current production application.
- Schedule a write freeze for the legacy application.
- Take and restore a final Supabase database dump and synchronize final Storage changes.
- Deploy Next.js against VPS PostgreSQL and the replacement object store.
- Keep Supabase read-only temporarily as a rollback source, then retire it after verification.

## Deployment Acceptance Criteria

- No production route renders demo or placeholder records.
- All legacy production workflows have an App Router equivalent.
- All database reads and writes happen on the server.
- All 19 new tables and changed columns are represented by migrations and module APIs.
- Authentication and authorization protect every internal page and mutation.
- AI, email, database, and storage credentials are server-only.
- Storage files are accessible from the replacement provider.
- Supabase row counts and critical record samples match VPS PostgreSQL.
- Backup restoration has been tested.
- No Supabase runtime dependency remains.
- A staging sign-off is completed before production traffic is switched.

## Verification Completed

- Added ticket-only notifications with explicit role audiences stored on each ticket, server-side
  audience enforcement, and per-user read receipts.
- Added optional Web Push delivery with per-user device subscriptions, stable VAPID credentials,
  stale-subscription cleanup, and notification click-through to Tickets.
- Added an installable PWA manifest, generated 180/192/512 icons, a controlled service-worker
  update lifecycle, an offline fallback, static-only caching, and mobile sidebar behavior.
- Added a standalone Next.js Docker runtime and production Compose service.
- The production service joins the existing external `deploy_default` network as `ccc-ops-web` and
  connects to database `ccc_ops` through the restricted `ccc_ops_app` role.
- Added `/api/health` to verify both the Next.js runtime and PostgreSQL connectivity.
- Production hostname ownership moved from a Worker Custom Domain to the existing VPS Caddy
  deployment; R2 CORS remains restricted to `https://internal.ccclub.id`.

- ESLint passed after the refactor.
- The optimized Next.js production build passed.
- The Auth.js session endpoint returned `200` with no active session.
- Unauthenticated `/dashboard` requests redirected to `/sign-in`.
- Browser smoke testing confirmed that bootstrap credentials sign in successfully and reach `/dashboard`.
- Browser smoke testing confirmed that the authenticated topbar exposes the sign-out control.
- TypeScript `tsc --noEmit` passes after the Cloudflare, R2, migration, CRUD route, CRM matching, and Anthropic work.
- Focused ESLint passes for application, API, data-layer, authentication, and Cloudflare configuration code.
- The optimized Next.js build passes with 48 App Router routes.
- OpenNext Cloudflare packaging passes and generates `.open-next/worker.js`.
- Local middleware smoke checks pass: `/dashboard` redirects unauthenticated users, `/sign-in` renders, and protected API handlers return JSON `401` responses.

## Current Boundaries

- The high-priority new data modules listed in the progress section now use real App Router pages and module APIs. Older untouched modules still render shared placeholder/demo views.
- The Supabase schema and data were restored into VPS database `ccc_ops`; all 62 public tables and the committed parity migrations were applied.
- The restricted `ccc_ops_app` role can access the migrated schema, including 550 buyer rows and the `count_unique_buyers()` function result of 418.
- Supabase Storage was copied to the private R2 bucket `ccc-ops`; 298 objects were validated and stored under their original bucket-name prefixes.
- Stored Supabase object URLs were normalized to R2 object keys, and R2 CORS is restricted to `https://internal.ccclub.id`.
- The first PostgreSQL-backed Auth.js administrator account has been created; bootstrap environment credentials are no longer required.
- Production still requires the VPS `.env.production`, Caddy route, Cloudflare DNS record, initial container build, smoke testing, backup automation, and monitoring.
- The refactor branch must not be deployed until the acceptance criteria above are satisfied.
