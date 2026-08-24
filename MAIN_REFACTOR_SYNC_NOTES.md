# Main to Refactor Synchronization Notes

Last reviewed: 24 August 2026

## Comparison baseline

- Updated legacy source: `main` at `7264991` (`index.html`, 24,271 lines).
- Current Next.js target: `refactor` at `9f5c9fc`.
- Common ancestor: `72a7820` from 13 June 2026.
- Previous parity source: `C:/Users/User/Downloads/rawfile.html`, the 24,187-line file used by the 1 July audit.
- Delta from that previous HTML source to current `main`: 135 insertions and 51 deletions.

No new Supabase table names, storage bucket names, or RPC names were introduced in this delta. The
new work is primarily column-contract, workflow, and UI parity. The existing
`REFACTOR_PARITY_AUDIT.md` remains useful for the broader migration, but it does not include the
changes below.

Severity: P0 = data loss or a production feature cannot work; P1 = visible workflow or calculation
mismatch; P2 = interaction/polish mismatch.

## Open synchronization work

### P0: Talent Pool import layout changed

Current `main` changed the positional Google Sheets mapping in `tpFetchSheets()`
(`main:index.html:19903`):

| Field | Previous/refactor index | Current main index |
|---|---:|---:|
| `sumber` | 5 | 6 |
| topic | 6 | 7 |
| `domisili` through `linkedin` | 8-21 | 9-22 |
| `produk_dibeli` | 23 | 24 |

The refactor still uses the old positions in
`app/api/talent-pool/import/route.ts:66`. Importing the current sheet can therefore shift data into
the wrong columns.

Do not copy the new HTML mapping blindly. Current `main` writes the topic to `topik`, while its UI
and the PostgreSQL schema use `topik_minat`. It also maps both `produk_dibeli` and `kepuasan` from
index 24. Confirm the latest sheet headers, map the topic to `topik_minat`, and keep header-based
aliases as the primary import strategy. Positional mapping should be a tested fallback with a
preview/warning when the detected layout is unknown.

Acceptance criteria:

- Add a fixture representing the latest sheet layout.
- Verify every imported field from `sumber` through `kode_voucher`.
- Preserve old exported sheets where their headers are recognizable.
- Do not write the HTML-only `topik` key to PostgreSQL.

### Completed: Content Library Organic and Ad Ideas

Implemented on `refactor` on 24 August 2026 with `014_content_library_parity.sql` and the dedicated
`ContentLibraryWorkspace` component. Deployment verification remains open until the migration is
applied on the VPS.

Current `main` added `content_library.tipe` with values `organic` and `ads`, defaults old rows to
`organic`, and renders separate `Organic Ideas` and `Ad Ideas` tabs
(`main:index.html:21860-21925`). Uploads and Design Assets to Content Library transfers now require
the type and persist it (`main:index.html:15879-15988`, `22057-22340`).

The refactor currently loads all content into one gallery and has no `tipe` field in its migration,
record definition, upload form, or Design Assets transfer flow.

Implemented behavior:

- Add a migration for `content_library.tipe`, backfill existing rows to `organic`, and constrain the
  supported values.
- Add route-level or client tab filtering while keeping a separate App Router page for the module.
- Include `tipe` in create, edit, upload, and Design Assets transfer actions.
- Keep all existing gallery filters and R2 object-key behavior inside each tab.

### P0: KOL records changed to multi-platform fields

Current `main` writes and displays independent Instagram and TikTok identities:
`username_ig`, `followers_ig`, `username_tiktok`, and `followers_tiktok`. It also uses
`linkedin_url`, `rate_card_text`, `catatan`, `foto_url`, and `rate_card_file_url`
(`main:index.html:15451-15486`, `15667-15683`).

The refactor migration and UI still use one generic `username`, `platform`, `followers`,
`engagement_rate`, `contact`, `rate_card_url`, and `notes`
(`database/migrations/001_production_feature_parity.sql:146`,
`app/_components/content-planning-tools.tsx:742-825`). This is not compatible with current
production records and can hide one platform or write to columns the HTML no longer uses.

Required work:

- Inspect the migrated `kol_list` columns before writing the migration.
- Add the current multi-platform columns without dropping generic columns until data is backfilled.
- Backfill compatible values from the generic model where possible.
- Update KOL cards, search, create/edit forms, and API actions to the current production fields.
- Preserve existing R2 photo and rate-card object keys.

### P1: Carousel plans gained a reference URL

Current `main` added `carousel_plans.link_referensi`, displays a purple reference chip, and supports
inline add/edit (`main:index.html:14809`, `15275-15289`).

The refactor supports only `link_brief` in the schema, action input, modal, and card
(`database/migrations/001_production_feature_parity.sql:133`,
`app/actions/content-planning-actions.ts:114-172`,
`app/_components/content-planning-tools.tsx:434-515`).

Add the column, include it in create/update inputs, and restore the card-level open/edit behavior.

### P1: Story vs Buyer denominator must use unique buyers

Current `main` now calculates total buyers as unique WhatsApp numbers, falling back to row IDs
(`main:index.html:13469`). The refactor passes `buyers.length` directly into the Story vs Buyer view
(`app/_components/content-evaluation-tools.tsx:125`) and therefore overstates the denominator when a
buyer has multiple transactions.

Use the same normalized buyer identity used by CRM grouping. The conversion numerator should also
be reviewed for duplicate transactions so both sides of the ratio have explicit semantics.

### P1: Talent Pool analytics gained two distributions

Current `main` added separate `Study Abroad` and `Organization Experience` charts and separated
cohort from graduation year (`main:index.html:20251-20291`). The refactor already separates
`angkatan` and `tahun_lulus`, but its analytics list does not include `exchange` or `organisasi`
(`app/_components/talent-pool-workspace.tsx:102`). Add those two distributions and match the legacy
empty/unknown handling.

### P2: CRM repeat-buyer stat and shift-range selection

Current `main` added a `Repeat Buyers` KPI and Shift-click range selection for grouped buyer rows
(`main:index.html:3742-3758`, `3859-3914`). The refactor already has repeat-order filtering and
analytics, but the KPI strip omits repeat buyers and checkboxes only toggle one row at a time
(`app/_components/crm-workspace.tsx:52`, `106-125`).

Add the KPI from grouped customers with `txCount > 1`. Add Shift-click selection using the current
filtered row order so a range never includes rows hidden by filters or pagination.

## Legacy-only fixes that do not need a direct port

- Changing `supabase.rpc(...)` to `_sb.rpc(...)` is specific to the single-file SDK wrapper. The
  Next.js code should continue querying PostgreSQL through `lib/api/*`.
- Removing client-generated buyer IDs is already covered by PostgreSQL UUID defaults.
- The null guard around the legacy ticket type select is not a new ticket feature.
- The Content Library implementation must store R2 keys, not copy public Supabase URLs.

## Suggested implementation order

1. Confirm the live `talent_pool`, `kol_list`, `content_library`, and `carousel_plans` schemas.
2. Add one idempotent migration for the new columns and backfills.
3. Fix the Talent Pool importer and add mapping tests before accepting another spreadsheet import.
4. Implement KOL multi-platform forms/actions.
5. Add the carousel reference link and metric corrections.
6. Add CRM Shift-selection last because it has no database impact.

## Verification checklist

- Existing Content Library rows appear under Organic Ideas after migration.
- New Ad Ideas remain isolated from Organic Ideas through create, edit, refresh, and Design transfer.
- A KOL can retain Instagram, TikTok, LinkedIn, photo, and rate-card data simultaneously.
- Latest and previous Talent Pool sheet fixtures import without shifted columns.
- Story vs Buyer reports a unique-buyer denominator for duplicate transaction rows.
- Carousel reference URLs survive create, edit, reload, and deletion.
- CRM Shift-click selects only the visible contiguous range.
