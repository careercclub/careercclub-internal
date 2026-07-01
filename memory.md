# CareerCclub Internal Ops Refactor Memory

Last updated: 1 July 2026

## Objective

Replace the founder's single-file HTML/Supabase application with a maintainable TypeScript Next.js
App Router application while preserving the production workflows from `rawfile.html`.
`REFACTOR_PARITY_AUDIT.md` is the parity checklist used for the current correction pass.

## Current Architecture

- Next.js 16 App Router, React 19, and TypeScript.
- Separate routes for each operational module and submodule; this is not a one-page conversion.
- Auth.js credentials authentication backed by PostgreSQL `auth_users`.
- PostgreSQL 17 in the existing `deploy-postgres-1` container, database `ccc_ops`.
- Next.js runs as `ccc-ops-web` on the shared Docker network; port 3000 is not published to the VPS.
- Existing Caddy terminates origin TLS and proxies `internal.ccclub.id` to `ccc-ops-web:3000`.
- Cloudflare provides DNS and proxying for `internal.ccclub.id`.
- Cloudflare R2 private bucket `ccc-ops` stores uploads under the migrated Supabase bucket prefixes.
- Resend sends email, Web Push handles ticket notifications, and Anthropic powers structured imports.
- The application has a manifest, service worker, offline route, install UI, and push subscription UI.

This application is dynamic SSR and connects to PostgreSQL. The current production target is the VPS
Docker service behind Cloudflare, not a static export.

## Database Migrations

Migrations must be applied in filename order:

1. `001_production_feature_parity.sql`: production tables and changed columns.
2. `002_crm_buyer_matching.sql`: normalized CRM buyer matching functions and indexes.
3. `003_normalize_r2_storage_keys.sql`: converts migrated Supabase URLs to R2 object keys.
4. `004_ticket_notifications_and_pwa.sql`: ticket notification audiences, receipts, and push subscriptions.
5. `005_workflow_integrity.sql`: content-to-ads deduplication and workflow indexes.
6. `006_app_settings.sql`: application-owned settings storage and role grants.
7. `007_parity_contract_corrections.sql`: legacy status, priority, phase, and conversion vocabularies.
8. `008_talent_pool_parity.sql`: Talent Pool survey and voucher fields.
9. `009_product_knowledge_parity.sql`: product assets, feedback, and knowledge fields.
10. `010_instagram_baseline_parity.sql`: persisted Instagram follower baseline.
11. `011_program_post_event_parity.sql`: post-event outcomes, notes, type, and links.

The Supabase schema/data and R2 objects have already been migrated. The VPS database contains both
`buyers` and `crm_buyers`; application role `ccc_ops_app` has access to `public`, and buyer counts were
verified during migration.

## Implemented Module Parity

### Authentication And Shell

- Credentials sign-in, active-user checks, role/session data, sign-out, and user administration.
- App Router navigation, mobile/desktop sidebar scrolling, route-level pages, and dashboard shell.
- Navigation badges for outstanding program tasks and tickets.
- Operational settings for menu visibility and master data.

### Tickets And Notifications

- Ticket board, role visibility, full detail editing, assignments, comments, links, attachments,
  duplication, deletion, and Google Calendar integration.
- Ticket/task status, priority, and phase vocabularies match the legacy contracts.
- Ticket changes produce role/user-targeted notification records and optional email/push delivery.
- Notifications intentionally remain ticket-only because that was the requested first scope.

### CRM And Talent Pool

- CRM KPIs, grouped buyers, nine filters, detail view, analytics, bulk actions, email, and multifile import.
- Product values found during CRM import can be learned into the product master.
- Talent Pool tabs, search/filtering, analytics, detail view, original Sheets mapping, and voucher fields.
- Email blast supports all filtered recipients, batches of 100, and optional scheduling.

### Program And Dashboard

- Program overview, event history, month calendar, drag workflow, task Kanban, and task tools.
- Event rundown editor with calculated times, row ordering, MC cues, notes, links, and duration.
- Post-event participant outcome, notes, program type, and links.
- Dashboard month calendar and AI command parser for supported operational records.

### Products And Vouchers

- Master-detail product workspace, classifications, features, benefits, bundles, subproducts, links,
  pain/passion points, assets, feedback, filters, pricing, duplication, and CSV export.
- Product pain/passion contracts and status values match the legacy application.
- Voucher eligibility and calculator behavior restored without the invented usage counter.

### Content And Marketing

- Story and carousel planning by date, reusable links, CTA choices, KOL/MT lists, calendar, and AI import.
- Content Evaluation formulas, grading, insights, format trends, calendar, Story-vs-Buyer view,
  advanced metrics, imports, and record detail.
- Meta Ads synchronization, funnel metrics, filters, decision library, and legacy boost thresholds.
- Instagram original UTF-16/multifile import, Monday aggregation, persisted baseline, derived followers,
  30-day summary, targets, projections, charts, and paginated history.
- Customer Knowledge category/keyword/platform/month analytics, labels, filters, and expandable records.
- Free Class distributions for 13 ratings, respondent dimensions, open answers, and respondent table.

### Talent, Partnerships, And Intelligence

- MT vacancy dashboard, vacancy list, newsletters, company intelligence, import, and management.
- B2B and organization partnership overview, analytics, pipeline, database, detail, CSV, and AI parser.
- Competitor overview, threats, filters, product/profile metrics, record cards, and detail modal.

### Assets, Collaborators, And Resources

- Content Library and Design Assets galleries with multi-image records, carousel detail, metadata,
  categories, labels, performance sorting, upload, paste, and drag/drop.
- Collaborator/advisor views, status, obligations, services, Privy metadata, image upload, and fallback avatar.
- Resources grouped by category with password reveal/copy, icons, management, and ordering.
- R2 uploads use presigned URLs; PostgreSQL stores object keys rather than file bytes.

## Remaining Known Parity Gaps

The major workflows and backend integration are implemented, but these audit items remain candidates
for a later polish pass rather than reasons to claim exact pixel/interaction parity:

- CRM import has direct processing but not the legacy staged QC preview experience.
- Settings can hide menu entries, but full dynamic menu relabeling and drag reordering are not restored.
- The legacy shared searchable select, date picker, modal, and toast primitives were not copied verbatim.
- Existing content-asset image deletion/editing is less complete than new upload and gallery viewing.
- Competitor product contextual editing is less rich than the legacy embedded editor.
- Global activity notifications were deliberately not restored; notification scope is ticketing only.

## Production Deployment

From the application directory on the VPS:

```bash
git pull origin refactor

for migration in \
  009_product_knowledge_parity.sql \
  010_instagram_baseline_parity.sql \
  011_program_post_event_parity.sql
do
  docker exec -i deploy-postgres-1 \
    psql -U ccc_user -d ccc_ops -v ON_ERROR_STOP=1 \
    < "database/migrations/$migration" || exit 1
done

docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100 web
curl -fsS https://internal.ccclub.id/api/health
```

Required runtime configuration is documented in `.env.example`. Important groups are PostgreSQL,
Auth.js, R2, Resend, Google Calendar, Anthropic, and VAPID. Secrets belong only in `.env.production`
on the VPS and must not be committed.

## Verification

On 1 July 2026:

- `npm.cmd run lint` passed with zero errors and one blob-preview `<img>` performance warning.
- `npm.cmd run build` passed with Next.js 16.2.9 and generated all 79 App Router routes.
- The local build logged missing `DATABASE_URL` during optional page-data reads because no local runtime
  database variable was configured; the build exited successfully. Production must provide it.

After deployment, smoke-test sign-in and at least Tickets, CRM, Program, Products, Content Planning,
Instagram, storage upload, notification subscription, and settings with the production role.
