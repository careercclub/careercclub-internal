# CareerCclub Internal Refactor Memory

This file records the refactors completed while converting the original internal operations page into the current application.

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

## Authentication Refactor

- Added Auth.js / NextAuth v5 with the credentials provider.
- Added the App Router auth handler at `app/api/auth/[...nextauth]/route.ts`.
- Added server-side credential verification in `auth.ts`.
- Added an edge-safe shared auth configuration in `auth.config.ts`.
- Added Next.js 16 route protection through `proxy.ts`.
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

## Verification Completed

- ESLint passed after the refactor.
- The optimized Next.js production build passed.
- The Auth.js session endpoint returned `200` with no active session.
- Unauthenticated `/dashboard` requests redirected to `/sign-in`.
- Browser smoke testing confirmed that bootstrap credentials sign in successfully and reach `/dashboard`.
- Browser smoke testing confirmed that the authenticated topbar exposes the sign-out control.

## Current Boundaries

- The module pages currently preserve the previous interface structure with placeholder/demo content; the feature APIs exist but are not yet connected to every page interaction.
- Supabase storage buckets such as `design-assets` and `task-attachments` were not migrated to Postgres because file storage requires a separate provider or object-storage decision.
- Production deployments still require real Postgres, Auth.js, bootstrap/user, and Resend environment values.
- Bootstrap credentials are intended only for initial access and should be removed after real `auth_users` accounts are created.
