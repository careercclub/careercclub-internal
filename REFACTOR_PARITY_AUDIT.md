# CCC Internal Dashboard — Refactor Parity Audit

> Update (24 August 2026): production `main` advanced to `7264991` after this audit. Read
> [`MAIN_REFACTOR_SYNC_NOTES.md`](MAIN_REFACTOR_SYNC_NOTES.md) for the newer HTML changes and open
> synchronization work. This document still describes the broader July parity baseline.

**Date:** 2026-07-01
**Branch audited:** `refactor`
**Source of truth at audit time:** legacy single-file SPA `rawfile.html` (24,186 lines; client JS + Supabase + localStorage). Current production `main` is newer; see the synchronization note above.
**Under audit:** Next.js 16 App Router project (Postgres + server actions + NextAuth + R2).
**Method:** 8 parallel domain reviews comparing every user-facing feature in the HTML against the corresponding Next.js route / component / action / API. Architecture changes (Supabase→Postgres, client→server, localStorage→DB, TypeScript, file layout) are **intended** and are not counted as findings.

Severity: **P0** = major feature missing / broken / silent data break · **P1** = notable workflow gap · **P2** = minor or cosmetic.

---

## 1. Executive summary

The refactor is a strong **architecture migration** wrapped around a major **UI/workflow regression**. The server foundation (Postgres, server actions, NextAuth, R2, PWA, migrations `001`–`006`) is real and well-built. But the application layer was flattened: **57 of 60 dashboard pages now render the same generic table component** ([`app/_components/record-manager.tsx`](app/_components/record-manager.tsx)), and the bespoke dashboards, kanban boards, pipelines, analytics charts, galleries, import wizards, and the AI command bar were **not ported**.

The repo's own `memory.md` claims "feature parity." That claim reflects *routes compiling and data reading/writing* — not feature parity. Measured on user-facing features and workflows, parity is roughly **30–40%**.

## 2. Root cause

Every module was reduced to a config entry in [`lib/records/catalog.ts`](lib/records/catalog.ts) (57 table definitions) rendered by [`record-manager.tsx`](app/_components/record-manager.tsx). That component supports only: a header + record count, sub-nav links, an "Add record" `<details>` form, a single flat table (fixed server-side sort, cells via `displayValue`), and a per-row edit/delete popover. It has **no tabs, charts, filters, sort controls, badges/pills, expandable rows, inline-cell edit, drag-drop, or galleries.**

Anything richer than a table therefore disappeared unless a bespoke `*-tools.tsx` component re-added it — and those components are thin (import buttons, an AI parser, a read-only metric strip). This single architectural ceiling explains the large majority of the divergences below.

## 3. Module scorecard

| Module | Parity | Headline loss |
|---|---|---|
| CRM | 🔴 Major | WA-grouping, 5 stat cards, 9 filters, bulk actions, customer modal, 7-chart analytics, entire Email Blast suite |
| Products | 🔴 Major | Master-detail workbench dismantled; bundle merged-KB + discount calc gone; Assets & Feedback sections dropped entirely |
| Program | 🔴 Severe | 4-tab dashboard, task kanban, month calendar w/ drag-reschedule, rundown editor, event links → one flat table |
| Content Evaluation | 🔴 Major (math ✅) | Scoring formulas exact, but 4-tab workspace + charts + detail modal gone; advanced-metric inputs unreachable |
| Instagram | 🔴 Major | All 3 charts gone, baseline engine removed, projection math changed, Meta-CSV import incompatible |
| Customer Knowledge | 🔴 Major | Dashboard charts, label-chip widget, all filters gone (AI screenshot parse survived) |
| Job Vacancy MT | 🔴 Major | Dashboard charts + WA/Email newsletter generator + company-intel gutted |
| Design / Library / Collaborators | 🔴 Severe | Galleries → single thumbnails; paste-to-upload gone; carousels, tabs, badges dropped |
| Voucher | 🔴 Broken | Invented a usage counter not in production; dropped calculator + product eligibility |
| Settings | 🔴 Major | 8 config tabs → 1 raw key/value table |
| Free Class | 🔴 Major | Per-aspect rating analytics + open-ended answer cards gone (import survived) |
| Tickets | 🟠 Partial | Detail drawer stripped; status vocabulary changed; auto-email → in-app notif |
| Meta Ads | 🟠 (math ✅) | Score engine faithful, but eval→ads auto-sync + one-click decisions + funnel badges gone |
| B2B / Org Partnership | 🟠 Simplified | Overview dashboards, inline-edit grids, filters, curated CSV, partner-picker quick-add gone |
| Competitor Intel | 🟠 Partial | Overview analytics + rich cards gone (snapshots/flags now reachable — improvement) |
| Resources | 🟠 Partial | Reorder survived (↑↓ buttons); credential masking/copy + category grouping gone |
| Dashboard / Shell | 🟠 Divergent | AI free-text command bar gone; month calendar → 7-day strip; nav badges, role-nav, config menu gone |
| Notifications | 🟠 Divergent | Global all-module activity feed → tickets-only |
| Shared widgets | 🟠 | Custom searchable dropdown, date-picker, toast, confirm-delete modal dropped |

---

## 4. Silent behavioral breaks (P0 — fix regardless of the UI work)

These change behaviour quietly and can corrupt data or break matching. Cheap to fix, independent of any UI decision.

1. **Email token `{nama}` → `{{nama}}`.** [`app/api/send-email/route.ts:45`](app/api/send-email/route.ts) only replaces `{{nama}}`. Legacy templates using `{nama}` render the literal token. HTML used single-brace everywhere (`rawfile.html:4374, 20555`).
2. **CRM convert-status em-dash → hyphen.** HTML writes `"Sudah convert — Upsell"` (em-dash, `rawfile.html:4822`); Next.js writes `"Sudah convert - Upsell"` (hyphen, [`lib/api/crm.ts:182`](lib/api/crm.ts)). Breaks any exact-match pill/filter.
3. **Ticket status vocabulary changed.** `Todo/In Progress/Done` (`rawfile.html:5677`) → `Open/In Review/In Progress/Done/Rejected` ([`ticket-tools.tsx:9`](app/_components/ticket-tools.tsx), [`catalog.ts:313`](lib/records/catalog.ts)). Breaks tab semantics, status flow, and the task-sync mapping ([`lib/api/program.ts:82`](lib/api/program.ts)). Priority also changed `High/Med/Low` → `Low/Med/High/Urgent`.
4. **Product status vocabulary changed.** `Live/Draft/Pre-launch/Archived` (`rawfile.html:9216`) → `Active/Draft/Archived` ([`catalog.ts:201`](lib/records/catalog.ts)). Legacy "Live"/"Pre-launch" rows won't match new pills/filters.
5. **Voucher invented a `terpakai`/`kuota` usage counter** ([`lib/api/voucher.ts:19`](lib/api/voucher.ts), [`voucher-actions.ts:7`](app/actions/voucher-actions.ts), `terpakai` field at [`catalog.ts:56`](lib/records/catalog.ts)). Production HTML has no used-count concept (`voucherStatus` is date-only, `rawfile.html:21138`); the "Habis" state is fabricated. Well-engineered, but not a port.
6. **Design→Library copy writes hardcoded values.** [`asset-actions.ts:23`](app/actions/asset-actions.ts) sets `platform:"Instagram", jenis:"Carousel", likes:0`, `copywriting = asset.nama`, and bypasses the library's "likes required" rule. HTML opened a prefilled modal for user input (`rawfile.html:15807`).
7. **Content-Eval advanced metrics are unreachable.** The scorer reads `wtr`, `nf_pct`, `link_taps`, `exits`, `replies`, `taps_back`, `stickers_interact` ([`lib/analytics/content.ts:24,36-79`](lib/analytics/content.ts)), but the import route ([`app/api/content-evaluation/import/route.ts:38`](app/api/content-evaluation/import/route.ts)) never writes them and the edit form ([`catalog.ts:41`](lib/records/catalog.ts)) never exposes them. Every Reel/Feed silently falls back to the ER-only path; the adaptive scoring cannot fire.

---

## 5. What genuinely survived or improved (do not redo)

- **Server foundation**: Postgres data layer, server actions, NextAuth (bcrypt/JWT/roles/active-user), R2 presigned uploads, PWA + web-push, migrations `001`–`006`. This is the hard, valuable part and it is solid.
- **Scoring math ported exactly** — Content-Eval Reel/Feed/Story and Meta Ads formulas verified line-by-line ([`lib/analytics/content.ts`](lib/analytics/content.ts) vs `rawfile.html:13053-13199, 13879-13885`). No numeric drift.
- **XLSX import added** on top of CSV in several importers (net upgrade; HTML was CSV-only).
- **AI screenshot parser** (Customer Knowledge) survived and improved — categories constrained server-side ([`app/api/ai/parse-screenshot/route.ts:27`](app/api/ai/parse-screenshot/route.ts)).
- **Server-side logic preserved**: ticket numbering `TKT-001` (advisory-locked, [`lib/api/tickets.ts:99`](lib/api/tickets.ts)), duplication, task↔ticket bidirectional sync ([`lib/api/program.ts:106`](lib/api/program.ts)), Google Calendar event creation.
- **Pipeline drag-drop** (CRM + partnerships) works with a mobile `<select>` fallback ([`app/_components/pipeline-board.tsx`](app/_components/pipeline-board.tsx), [`app/actions/pipeline-actions.ts`](app/actions/pipeline-actions.ts)).
- **Competitor snapshots/flags** are now reachable routes — they were orphaned/dead code in the HTML (`openCiSnapshotModal`/`openCiFlagModal` defined but never invoked, `rawfile.html:18596`).
- **Resources reorder** persists via transaction ([`lib/api/resources.ts:19`](lib/api/resources.ts)).
- **Voucher usage counter** — genuinely atomic and well-built (see break #5 for the caveat that it's an unintended addition).

---

## 6. Detailed findings by domain

### 6.1 CRM + Talent Pool + Deals + Email Blast

**Verdicts:** CRM buyers grid P0 · CRM analytics P0 (absent) · Email Blast P0 (absent) · Lynkid import P1 · CRM deals P1 · Talent Pool P1 · Master Produk at parity (relocated to `/products/mapping`).

- **[P0] Buyer table grouped-by-WA is gone.** HTML groups all transactions per WA into one customer row with `txCount`, worst-payment, summed spend (`rawfile.html:3798 getGroupedBuyers`, `3858 renderBuyers`). Next.js renders raw `buyers` rows 1:1 ([`app/(dashboard)/crm/page.tsx`](app/(dashboard)/crm/page.tsx), `record-manager.tsx:80`). Repeat buyers now appear as N duplicate rows.
- **[P0] 5 stat cards missing / changed.** HTML: Total Buyers (unique via RPC), Total Transaksi, Belum Isi Pool, Sedang Diblast, Sudah Convert (`rawfile.html:3741`). CrmTools shows a different strip (total/pending payment/failed/converted/talent matches, [`crm-tools.tsx:14`](app/_components/crm-tools.tsx)). `countUniqueSuccessfulBuyers()` was ported ([`lib/api/crm.ts:44`](lib/api/crm.ts)) but is **never called** (dead code).
- **[P0] 9 filters reduced to 0.** HTML: search + Klasifikasi, Industri, Tahap, Status-blast, Talent-pool, Sumber, Payment, Riwayat + clear (`rawfile.html:3605`). CRM page has no filter bar at all.
- **[P0] Bulk action bar gone.** HTML: multi-select, "Tandai sebagai…", talent-pool mark, Download CSV, bulk delete with confirm (`rawfile.html:3617`, `applyMark/applyPool/downloadSelected/deleteSelectedBuyers` 3912-3978). None in Next.js.
- **[P0] Customer detail modal gone.** HTML `openCustModal` (`rawfile.html:5074`): avatar, active deals, editable info grid, total spend, full transaction history timeline. No equivalent.
- **[P0] CRM Analytics view entirely absent.** HTML `renderCRMAnalytics` (`rawfile.html:3996`): 7 charts (Repeat Order, Klasifikasi, Talent Pool, Tahapan, Industri, Sumber, Payment) + Export JSON (`4126`). No charts anywhere in the app.
- **[P0] Email Blast suite entirely absent from CRM.** HTML (`rawfile.html:4148-4642`): segment selector + filters + live recipient count, Quill rich-text editor with image handler, header/subtitle/color/CTA/footer builder, Preview, Save-as-template, Templates tab, History tab, Settings tab (Resend key/from-name/from-email). CrmTools has only import + export JSON.
- **[P1] Column set reduced & pills lost.** HTML table has 12+ columns with `klasPill/statusPill/paymentPill/talentPill` (`rawfile.html:3628`). Next.js: name, wa, email, produk, payment_status, status ([`catalog.ts:35`](lib/records/catalog.ts)) — plain text.
- **[P1] Lynkid QC preview modal removed.** HTML builds `qcRows` with per-row flags (WA kosong/aneh, Duplikat, Repeat buyer, Klasifikasi belum ketemu), dedupe keeping the SUCCESS row (`_dedupeQCRows` 4691), and a modal with summary chips, per-row checkboxes, and inline classification `<select>` (`rawfile.html:4721`). Next.js does a silent server import ([`app/api/crm/import/route.ts`](app/api/crm/import/route.ts)) — no preview, no per-row override.
- **[P1] Multi-file import lost.** HTML `<input multiple>` loops over files, deduping across them (`rawfile.html:4644`). Next.js accepts one file ([`crm-tools.tsx:61`](app/_components/crm-tools.tsx)).
- **[P1] CRM deal modal (create/edit) gone.** HTML `openDealModal`/`saveDeal` (`rawfile.html:4996`): customer picker, tipe, stage, target-product picker, harga, tanggal, catatan, delete. Next.js PipelineBoard has no "New deal" button/modal — deals only via the generic table.
- **[P1] Per-column target-value totals gone.** HTML shows `Target Rp X jt` per stage (`rawfile.html:4952`); PipelineBoard shows a count only.
- **[P1] Talent Pool import source changed.** HTML fetches a published Google Sheets CSV URL with a 25+ field positional map + anomaly-check modal (`rawfile.html:19805, 19850, 19918`). Next.js imports a CSV/XLSX file with ~15-field header aliasing ([`app/api/talent-pool/import/route.ts:23`](app/api/talent-pool/import/route.ts)) — no Sheets URL, no anomaly modal; drops fakultas, angkatan, organisasi, exchange, linkedin, relocate, topik_minat, nps, kepuasan, membantu, kode_voucher.
- **[P1] Talent Pool detail modal + 10-chart analytics gone.** HTML `tpOpenDetail` (`rawfile.html:19713`) and `renderTpAnalytics` (10 charts + Export JSON, `20105-20247`). No equivalent.
- **[P1] TP blast targeting reduced.** HTML: segment all/sudah_beli/belum_beli/custom with 11 filters (`rawfile.html:20273`). Next.js: "currently filtered rows" via search + one dropdown, capped at 100 ([`talent-pool-tools.tsx:23`](app/_components/talent-pool-tools.tsx)).
- **[P2] Master-produk auto-learn on import lost** (`rawfile.html:4789` vs `crm.ts:120`). Import reads mappings but never inserts new ones.
- **[P2] TP rich email builder → plain textarea** (`rawfile.html:20398` vs `talent-pool-tools.tsx:63`); scheduling field dropped; send batching/error-detail/`status→Diblast` update lost.
- **Master Produk at parity** — relocated to [`/products/mapping`](app/(dashboard)/products/mapping/page.tsx) (`master_produk`), same CRUD; `klasPill` preview + helper footer lost (P2 cosmetic).

### 6.2 Products

**Verdict: Major regression (P0).** The unified master-detail workbench (select product → accordion → view/edit all KB inline, bundle merge, duplication, export) was dismantled into a read-only summary grid + ~11 disconnected flat CRUD tables keyed by hand-typed UUIDs.

- **[P0] Master-detail accordion UX gone.** HTML list rows expand in place into a tabbed KB panel (`prodListItemHTML`/`toggleProdAccordion`/`prodAccordionPanelHTML` `rawfile.html:9504-9602`; full-page detail `prodDetailPageHTML:9425`). Next.js renders each product as a read-only `<article>` with no click/detail/inline-edit ([`product-tools.tsx:48`](app/_components/product-tools.tsx)).
- **[P0] Per-product KB editing removed → global flat tables.** HTML edits KB in the product's context (`renderPainPoints:10478`, `renderPassionPoints:10503`, `renderBenefits:9809`, `renderProductFeatures:9834`, `renderSubProducts:8184`). Next.js: separate pages ([`products/pain-points`](app/(dashboard)/products/pain-points/page.tsx) etc.), each requiring a manually-entered `product_id`/`feature_id` UUID ([`catalog.ts:222`](lib/records/catalog.ts)).
- **[P0] Bundle merged-KB logic absent.** HTML aggregates KB from a bundle's member products (`getBundleMergedKB`/`getBundleKBCount` `rawfile.html:8113`, grouped render `8121`). No equivalent — `product-tools.tsx:49` only counts a bundle's own rows; no bundle detail view.
- **[P0] Bundle pricing/discount calculator absent.** HTML `openBundlingModal`/`updateBundlingCalc` (`rawfile.html:10125`): live subtotal, computed discount %, "Hemat X%". Next.js bundles are a bare `bundle_id`/`item_id` join table.
- **[P0] "Aset Konten" (Assets) KB section dropped entirely.** HTML per-product content-asset manager (`renderAssets:11915`, add/update/delete). No `product_assets` table/subroute/catalog entry in Next.js.
- **[P0] "Feedback" KB section dropped entirely.** HTML per-product feedback log with type pill (`renderFeedback:12127`, `addFeedback:10250`). No table/subroute/catalog entry.
- **[P0] Per-product KB JSON export removed.** HTML "Export KB" per product/bundle (`exportSingleProductJSON:9968`). Next.js only has a workspace-wide raw dump ([`product-tools.tsx:29`](app/_components/product-tools.tsx)).
- **[P1] Type filter (Satuan/Bundling) removed** (`setProdTypeFilter:9264`); **classification filter removed** (`setProdKlasFilter:9283`); **product-list header stats removed** (`prodListPageHTML:9399`); **sort reduced** (no "lowest price", `toggleProdSort:9288`).
- **[P1] Create/edit modal simplified** — no bundle item-selector UI; bundle membership only via hand-entered UUIDs ([`catalog.ts:196`](lib/records/catalog.ts)). Note: `cover_url` upload is a Next-only addition.
- **[P1] Duplication scope** — Next.js `duplicateProduct` actually copies *more* (feature-links, sub-products, bundle items, [`lib/api/products.ts:112`](lib/api/products.ts)) but requires typing a new name and can't copy the now-removed assets/feedback.
- **[P2] Status vocabulary mismatch** (see break #4).

### 6.3 Program + Tickets

**Verdicts:** Program severe regression · Tickets partial.

**Program**
- **[P0] Program dashboard shell absent.** HTML 4 sub-tabs Overview/Events/History/Calendar (`rawfile.html:8756`). Next.js `/program` renders a generic events table only ([`app/(dashboard)/program/page.tsx`](app/(dashboard)/program/page.tsx)).
- **[P0] Task Kanban board missing.** 3-column kanban (Todo/On Progress/Done) with phase/priority pills, assignee, overdue-red deadline, attachment count, gcal button (`rawfile.html:9319`). Next.js tasks are a flat table.
- **[P0] Monthly calendar with drag-to-reschedule absent.** Events/tickets/tasks color-coded by phase, tasks draggable, `calDrop` writes new `due_date` (`rawfile.html:12628`). Next.js Program has no calendar; a weekly ticket-only drag calendar exists only on the Dashboard ([`dashboard-calendar.tsx:16`](app/_components/dashboard-calendar.tsx)).
- **[P0] Project Overview stats + progress cards absent** (`rawfile.html:10377`).
- **[P1] Rundown editor downgraded to flat table.** HTML inline-edit table with auto-computed running time, add/delete/move rows (`rawfile.html:12289`). Next.js `/program/rundown` is a plain RecordManager.
- **[P1] Event links section absent** (`rawfile.html:12409`); **post-event capture absent** (`capaian_peserta`/`notes_post` not even in the record definition, [`catalog.ts:28`](lib/records/catalog.ts)); **event-done confirmation flow absent** (`rawfile.html:10035`); **History tab absent** (`rawfile.html:12506`).
- **[P2] Task modal downgraded** — HTML auto-creates/links a ticket on save (`saveTaskModal:9758` → `syncTaskToTicket`); Next.js sync only fires via the manual "Repair task-ticket links" tool ([`program-actions.ts:27`](app/actions/program-actions.ts)), so creating a task no longer spawns a ticket automatically.
- **Additions:** AI "create task from text" parser and "Repair task-ticket links" button (not in HTML).

**Tickets**
- **[P0] Status vocabulary changed** (see break #3).
- **[P0] Ticket detail drawer stripped.** HTML edits judul/deskripsi/status/prioritas/divisi/deadline, multi-assignee chips, attachments w/ preview, links, comments, duplicate/delete/gcal/save (`rawfile.html:5848`). Next.js detail pane is read-mostly: status via `<select>` only; priority/deadline/assignees as plain text; no divisi/type/title/description edit; no delete ([`ticket-tools.tsx:54`](app/_components/ticket-tools.tsx)).
- **[P0] Auto-email on status/comment replaced by notifications.** HTML auto-opens Gmail compose on status→In Progress/Done and on every new comment (`rawfile.html:6145, 6186`). Next.js fires an in-app notification instead ([`ticket-actions.ts:36`](app/actions/ticket-actions.ts)); a manual "Send email" button exists but mails assignees only.
- **[P1] "Status & Email" master tab absent** (`rawfile.html:6798`); **per-user ticket visibility gone** (`getVisibleTickets:5693` scoped by role; Next.js lists all tickets to any user); **priority vocabulary changed**.
- **[Remediated] Per-ticket Google Calendar flow restored.** The list row and detail modal now open a dedicated modal with editable title/description, all-day or timed ranges, automatic assignee/requester guests, and optional CC guests ([`ticket-google-calendar-modal.tsx`](app/_components/ticket-google-calendar-modal.tsx)). Event IDs are stored so later actions update the existing event instead of creating an untracked duplicate.
- **[P2] New-ticket modal richness reduced** (CC tag input, multi-link rows, inline assignee picker → generic form + JSON textareas); **inline "Done" checkbox toggle absent** (`toggleTktDone:5825`).
- **Parity OK:** numbering, duplication, task↔ticket sync (server-side), and Google Calendar creation/re-sync.

### 6.4 Content Planning + Content Evaluation + Meta Ads

**Verdicts:** Planning FAIL · Evaluation FAIL (math ✅) · Meta Ads FAIL-UI / PASS-math.

**Content Evaluation — scoring verified faithful.** `lib/analytics/content.ts:16-94` matches `evalScoreReel`/`evalScoreFeed`/`evalScoreStory`/`getEvalScore` (`rawfile.html:13053-13199`) exactly (Reel WTR35/NF25/follow20/link10/save5/share5 + ER-fallback15; Feed follow35/link25/save15/share10/NF10/comments5 + ER-fallback15; Story exit30/tapsBack20/reply25/link20/stickers5; normalization `min(100,round(score/max*100))`). **But:**
- **[P0] Grade bands + insights + partial flag dropped.** HTML returns `{total, grade, partial, rates, insights[]}` (`rawfile.html:13101`); Next.js returns a bare number ([`content.ts:93`](lib/analytics/content.ts)). Score-pill colors, partial banner, and auto-insights all gone; component prints `{score}/100` only ([`content-evaluation-tools.tsx:26`](app/_components/content-evaluation-tools.tsx)).
- **[P0] Advanced-metric branches unreachable** (see break #7).
- **[P1] "Ads eligible" threshold mismatch** — Next.js uses `score >= 70`; HTML top-grade is `≥80` and the ads pull uses a separate gate.
- **[P0] 4-tab workspace absent** (Overview / Reels / Feed & Carousel / Story-vs-Buyer, `rawfile.html:13215`); **per-format metric tables absent** (`rawfile.html:13434`); **Story-vs-Buyer analysis absent** (`rawfile.html:13442`); **eval detail modal absent** (`rawfile.html:13862`).
- **[P1] Posting calendar absent** (`rawfile.html:13332`); **monthly bar charts absent** (`rawfile.html:13378`); **date-strip range filter absent** (`rawfile.html:13212`); **add/edit modal simplified** (no live score preview, no advanced metrics); **sort/filter reduced** to Highest-score/Newest.
- **Meta CSV + XLSX import both survived** ([`app/api/content-evaluation/import/route.ts:26`](app/api/content-evaluation/import/route.ts)); XLSX is an addition. The "not a Meta CSV" guard and NEW-vs-UPDATE preview are gone (silent skip of rows without Post ID).

**Meta Ads**
- **PASS: scoring engine faithful** — `scoreAdsCandidate` ([`content.ts:96`](lib/analytics/content.ts)) matches `adsScoreContent` (`rawfile.html:13879`) exactly (funnel/objective cascade included).
- **[P0] Candidate auto-sync from evaluation absent.** HTML mirrors eval content (score ≥70, format∈{Reel,Carousel}) into `ads_contents`, refreshing snapshots and pruning below-threshold rows while preserving decisions (`rawfile.html:13892`, `ADS_PULL_MIN_SCORE=70`). No equivalent in [`lib/api/meta-ads.ts`](lib/api/meta-ads.ts).
- **[P0] One-click decision workflow → dropdown.** HTML Boost/Skip/Pending buttons + funnel/objective tags per card (`rawfile.html:13886`) → generic `ad_decision` select ([`catalog.ts:46`](lib/records/catalog.ts)).
- **[P1] Funnel/objective badges + boost-signal not rendered; stat cards / filters absent** (`rawfile.html:13876`).

**Content Planning**
- **[P0] Story-plan grid → plain table.** HTML date-grouped planner with per-date slide rows, ordering, thumbnails, link fields, Draft/Done (`storyPlanHTML:14329`; `story_plan_dates/items/links`) → three separate generic tables ([`catalog.ts:261`](lib/records/catalog.ts)).
- **[P0] Carousel-plan grid + CTA + links → plain table** (`contentHTML:14203`) → generic `carousel_plans` + separate `/cta` + `/carousel-links` tables.
- **[P0] KOL gallery → plain table** (`kol_list`, photo/rate-card as bare URL fields); **MT Story gallery → plain table** (`mt_story_list`); **content photo upload simplified** (`sb_uploadContentPhoto:~2621` → generic R2 field); **both planning calendars absent**.
- **[P1] AI story-plan parser** exists ([`story-plan-ai-parser.tsx`](app/_components/story-plan-ai-parser.tsx)) — retained, feeds `story_plan_*` tables rather than a live grid.

### 6.5 Instagram

**Verdict: FAIL — major loss of parity.** Purpose-built analytics dashboard → generic CRUD table + read-only tools strip.

- **[P0] Followers trend chart** (Actual vs Prediction vs Target, monthly bars + regression line) — `rawfile.html:17855`. **Absent** (no chart library in the repo).
- **[P0] Weekly metrics chart** (Reach + Interactions) — `rawfile.html:17941`. **Absent.**
- **[P0] "Avg Follows per Hari" widget** (paginated bar mini-chart + week nav + delta) — `rawfile.html:18038`. **Absent.**
- **[P0] Baseline (value + date) engine removed** — anchor for all follower math (`rawfile.html:17762, 18119`), editor `18264`, drives `igComputeFollowers()` back/forward-fill (`17788`). No baseline read/write/UI anywhere; `followers_total` shown as-imported.
- **[P0] `igComputeFollowers()` derived-followers engine gone** (`rawfile.html:17788`).
- **[P1] Three-tab workspace** (Dashboard / Upload CSV / Target & Baseline, `rawfile.html:18129`) → two routes `/instagram` + `/instagram/targets`.
- **[P1] Targets editor degraded** to generic RecordManager ([`app/(dashboard)/instagram/targets/page.tsx:6`](app/(dashboard)/instagram/targets/page.tsx)).
- **[P1] CSV import contract incompatible.** HTML: Meta Insights one-metric-per-file, multi-file, UTF-16, metric-title→key map, per-day parse, aggregate to Monday-week (`rawfile.html:18388`). Next.js: single UTF-8 workbook, row-1 header + column aliases, one row = one week ([`app/api/instagram/import/route.ts:11`](app/api/instagram/import/route.ts)). Same-format Meta exports will not import. (XLSX support is an addition.)
- **[P1] Growth/projection math changed** — HTML uses last-4-weeks `follows_gained/28` + baseline projection (`rawfile.html:18017, 18026`); Next.js uses `(latest−earliest)/span-days` ([`instagram-tools.tsx:12`](app/_components/instagram-tools.tsx)). Recent-momentum weighting lost.
- **[P1] CSV upload UI simplified** (drag-drop + multi-file + parsed preview → bare file input); **History table missing ER% column + pagination** (`rawfile.html:18218, 18306`).
- **[P2] Dashboard stat cards differ** (30-day rolling aggregates → single-latest-week); **annual-target progress partial**; **delete confirm/toast gone**.

### 6.6 Customer Knowledge + Competitor Intel + Job Vacancy MT

**Verdicts:** Customer Knowledge P0 · Free Class P0 · Competitor P1 · MT Vacancy P0.

**Customer Knowledge**
- **[P0] Dashboard tab entirely missing** — Top Kategori, Top Keywords word-cloud (TF/bigram), Entri-per-Platform + per-Bulan charts (`rawfile.html:10940`). Absent.
- **[P0] Labels column + label-dropdown widget missing** (`ppDDWidget` chips + "Buat label baru", `rawfile.html:12089`). `labels` is a raw JSON textarea, not a column ([`catalog.ts:190`](lib/records/catalog.ts)).
- **[P0] Database filters missing** (platform/bulan/kategori/label, `rawfile.html:11170`).
- **[P1] Expandable comment rows + inline edit gone** (`rawfile.html:11135`); **stats cards missing** (`rawfile.html:8447`).
- **OK: AI screenshot parse preserved and improved** ([`pain-point-ai-parser.tsx`](app/_components/pain-point-ai-parser.tsx); server-constrained categories).

**Free Class**
- **OK: import preserved (CSV + XLSX + Google-Sheet URL)** ([`free-class-tools.tsx:13`](app/_components/free-class-tools.tsx), [`lib/imports/free-class.ts`](lib/imports/free-class.ts)); XLSX is an addition.
- **[P0] Per-aspect rating analytics gone** — 13 aspects, bars + 1★–5★ distribution pills (`rawfile.html:11674`). Next.js shows a single global average + per-series count cards.
- **[P1] Top Universitas & Angkatan distributions missing** (`rawfile.html:11711, 11820`); **open-ended answer cards missing** (`rawfile.html:11776`); **collapsible respondent table missing** (`rawfile.html:11871`).
- **[P2] JSON export dropped** (`rawfile.html:11467`).

**Competitor Intel**
- **[P1] Overview/analytics tab missing** — 5 stat cards + competitor list + threat-level list (`rawfile.html:18644`). Only a 4-count strip ([`competitor-tools.tsx:13`](app/_components/competitor-tools.tsx)).
- **[P1] Profiles rich card grid + sort/filters + full modal flattened** (logo upload, platform/audience pills, per-platform followers, threat radio, `rawfile.html:18709, 18842`) → generic table with JSON fields.
- **[P1] Products gallery + multi-image/links/fitur + pricing-history modal flattened** (`rawfile.html:19042`) → generic table; `competitor_id` free text.
- **[P1] Product-category & target-audience settings masters absent** (`CI_PROD_CATEGORIES`/`CI_TARGET_AUDIENCE`, `rawfile.html:10784`) — were localStorage arrays in a global Settings tab; now free text.
- **[P2] No badges/pills/color-coding** (`rawfile.html:18624`). **Improvement:** snapshots/flags now reachable routes (dead code in HTML).

**Job Vacancy MT**
- **[P0] Dashboard tab missing** — 4 stats + "Loker Buka per Bulan" bar + "Distribusi Industri" doughnut + per-industry cards (`rawfile.html:16498`). Next.js: 4-count strip + active-vacancy list ([`mt-vacancy-tools.tsx:16`](app/_components/mt-vacancy-tools.tsx)).
- **[P0] Newsletter generator gutted** — HTML generates formatted WhatsApp *and* Email newsletters with month/week/industry filters + output tabs (`rawfile.html:1675, 16831`). Next.js copies a plain text digest to clipboard.
- **[P1] Company Intel tab missing** (per-program open-pattern history + "Pola berubah" flag, `rawfile.html:16615`); **list filters/search dropped**; **vacancy form simplified** (tag inputs + 12-month picker → JSON textareas); **Google-Sheet import path dropped** (file-only now).
- **OK: industries master + CSV/XLSX import preserved** ([`app/api/mt-vacancies/import/route.ts`](app/api/mt-vacancies/import/route.ts)); XLSX is an addition.

### 6.7 Voucher + Design + Resources + Content Library + Collaborators

**Verdicts:** Voucher broken · Design severely simplified · Resources partial · Library severely simplified · Collaborators severely simplified.

**Voucher**
- **[P0] Invented usage counter not in production** (see break #5); **discount calculator modal removed** (`openVoucherCalc`/`calcVoucher`, `rawfile.html:21422`).
- **[P1] Product eligibility UI lost** (checkbox list → raw `product_ids` text, `rawfile.html:21348` vs [`catalog.ts:56`](lib/records/catalog.ts)); **Overview tab removed** (`rawfile.html:21170`); **status pills differ** ("Used up" is new).

**Design Assets**
- **[P1] Sub-tabs (References vs Assets) removed** (`rawfile.html:15673`); **category filter → free-text search, grouping lost** ([`asset-gallery.tsx:20`](app/_components/asset-gallery.tsx)); **paste-to-upload removed** (`daPasteHandler`, `rawfile.html:15712`); **multi-image carousel preview modal removed** (`rawfile.html:16087`); **add-image-to-existing + per-image delete removed**.
- **[P2] Send-to-Library degraded** to a non-interactive hardcoded copy (see break #6).

**Resources**
- **[P1] Credential display UX removed** — password masking, show/hide eye, copy-to-clipboard, lock/link icon (`rawfile.html:21561`) → single plain line ([`resource-tools.tsx:19`](app/_components/resource-tools.tsx)); **category grouping removed**.
- **[P2] Drag-and-drop → ↑↓ buttons** (reorder persistence itself survives, [`lib/api/resources.ts:19`](lib/api/resources.ts)); add/edit is generic (no link-vs-credential toggle; password stored as plain text field).

**Content Library**
- **[P1] Entire filter bar removed** (Platform/Jenis/Label/Sort, `rawfile.html:21814`); **gallery card content stripped** (platform pill, image-count badge, label chips, stats → thumbnail + title + subtitle, `rawfile.html:21930`); **paste-to-upload removed** (`clPasteHandler`); **custom labels widget removed** (required labels → comma string); **carousel preview + add-image + single-delete removed** (`rawfile.html:22268`).

**Collaborators**
- **[P0] Collaborator vs Advisor tabs removed** — two tabs with different card layouts/fields (`rawfile.html:22814`).
- **[P1] No dedicated UI — reuses `AssetGallery`** ([`app/(dashboard)/collaborators/page.tsx:9`](app/(dashboard)/collaborators/page.tsx)), a semantic mismatch; **obligations (kewajiban) & services/rate editors removed** → raw JSON textareas ([`catalog.ts:308`](lib/records/catalog.ts)); note type mismatch `kewajiban` typed `{label,value}[]` ([`lib/api/collaborators.ts:9`](lib/api/collaborators.ts)) vs HTML `string[]`; **click/paste photo upload removed** (`rawfile.html:23106, 23002`); **Privy + status badges removed**.
- **[P2] Avatar-with-initials fallback removed**; **advisor status option set differs** (free text now).

**Cross-cutting (this domain):** paste-to-upload gone from all four upload areas; every multi-image carousel reduced to `storage_paths[0]` via `StorageImage`; feature-specific empty states replaced by generic "No records yet".

### 6.8 Shell / Dashboard / Settings / Auth / Notifications / Shared UI

**Verdicts:** Shell partial · Dashboard divergent · Settings P0 · Auth OK-ish · Notifications divergent · Shared widgets P1.

**Dashboard / AI**
- **[P0] AI free-text dashboard router MISSING.** HTML dashboard-level AI panel auto-detects the target module from free text and routes into 7 modules with parse→preview→confirm + name→ID resolution (`renderAIInputPanel`/`_aiParse`/`_aiConfirm`, `rawfile.html:5169`). Next.js `AiTextRecordParser` is a per-page `<details>` with a hardcoded `kind` ([`ai-text-record-parser.tsx:30`](app/_components/ai-text-record-parser.tsx)), never on the dashboard, cannot auto-detect.
- **[P1] Dashboard mini-calendar downgraded** — full month grid w/ 3 event types color-coded + drag-reschedule (`rawfile.html:3406`) → 7-day rolling ticket-only strip ([`dashboard-calendar.tsx:11`](app/_components/dashboard-calendar.tsx)).
- **[P2] Upcoming list scope reduced** (merged tasks+tickets, day-grouped → two separate unbounded lists, no tickets); **stat widgets differ** (Next.js adds 5 count cards — an addition; the `navigation.ts` `stats[]` arrays are dead demo data).

**Settings**
- **[P0] 8 tabs collapsed** — Master Produk, Master Ticket, Customer Knowledge Master, Menu config, Link Template, CI Lists, Klasifikasi, Content Planning CTA (`rawfile.html:8015`, `initSettingsTab:10645`) → single `RecordManager` over `app_settings` + a `/settings/users` page. Some masters survive as scattered record pages (via [`lib/records/links.ts`](lib/records/links.ts)) but the CI-list/klasifikasi/menu-config editors are gone.
- **[P1] Menu-config settings tab MISSING** (`getMenuSettingsHTML`/`applyMenuChanges`/`resetMenuSections`, `rawfile.html:12975`).

**Shell / Nav**
- **[P1] Configurable sidebar (sections/labels/reorder) LOST** (`renderSidebarFromConfig:12952`, `loadMenuSections:12901`) → static [`navigation.ts`](app/(dashboard)/_data/navigation.ts); only supports hiding slugs via a DB row with no UI.
- **[P1] Role-based nav visibility MISSING** (`updateNavForRole:6874` hides Master-Ticket for non-admins) — Next.js renders identical nav for all roles.
- **[P1] Nav badges NOT computed** (`updateSidebarBadges:3136` — active projects + open tickets) — absent.
- **[P2] Dynamic page-title map reduced** (30 entries incl. sub-tab titles → top-level nav title only); **sidebar collapse differs** (HTML persists `sidebarCollapsed`; Next.js has mobile open/close only, no desktop rail).

**Notifications**
- **[P0] Feed scope changed: global → tickets-only.** HTML `notifLoad` queries `activity_log` unfiltered — a global feed across ~40 module tables with per-module icons + read tracking (`rawfile.html:2007`, `_ACT_MODULE_MAP:1867`). Next.js `NotificationCenter` reads only `ticket_notifications`, always routing clicks to `/tickets` ([`notification-center.tsx:154`](app/(dashboard)/_components/notification-center.tsx)). Activity from other modules never surfaces.
- **[P2] Push/VAPID added** (net-new); **`logActivity` skip-list shrank** (11 → 6 tables, [`lib/api/activity.ts:5`](lib/api/activity.ts)).

**Shared UI widgets**
- **[P1] Custom searchable dropdown LOST** (`buildDropdown`, searchable + add-new + keyboard, used ~35×, `rawfile.html:5318`) → native `<select>`.
- **[P1] Custom calendar date-picker LOST** (`buildDatePicker`, `rawfile.html:5401`) → native `<input type="date">`.
- **[P1] Promise-based confirm-delete modal LOST** (`showConfirmDelete`, used ~49×, `rawfile.html:5604`) — destructive actions now have no confirmation UI.
- **[P2] Toast simplified** (`showToast`, used ~467× → inline form messages).

**Auth**
- **[P2] Post-login landing changed** (Tickets → `/dashboard`, [`app/sign-in/actions.ts:11`](app/sign-in/actions.ts)); **role model narrowed** (admin/lead/staff → admin vs non-admin; no division-scoped ticket filtering, [`auth.config.ts:23`](auth.config.ts)).
- **PWA:** net-new and richer than HTML; no parity loss.

---

## 7. Recommended remediation path

1. **Fix the silent breaks (§4) first.** ~1 day, high value, independent of any UI decision. Stops quiet data corruption and matching failures.
2. **Decide the architecture question.** Keep `RecordManager` as the default for genuinely tabular modules (masters, mappings, link tables), and graduate high-use modules to bespoke pages. Enumerate which modules "graduate" so remediation isn't fighting the same ceiling repeatedly.
3. **Rebuild the operational core, one module at a time**, in priority order:
   - **CRM** — WA-grouping + stat cards + filters + Email Blast + analytics.
   - **Program** — task kanban + monthly calendar w/ drag-reschedule + rundown editor.
   - **Products** — master-detail workbench + bundle merged-KB + Assets/Feedback sections.
   - **Tickets** — restore detail drawer + status vocabulary + role-scoped visibility.
   - **Content Evaluation / Instagram** — charts + advanced-metric inputs + baseline engine.
4. **Restore cross-cutting primitives** that many modules depend on: the shared searchable dropdown, date-picker, toast, and confirm-delete modal; nav badges; the AI command bar; the global notification feed.
5. **Reconcile data-model gaps** flagged above (missing `product_assets`/`product_feedbacks`/`capaian_peserta`/`notes_post`; Instagram baseline settings; competitor category/audience masters) before backfilling UI.

> Note: a few HTML features were already dead/orphaned code (competitor snapshots/flags, the voucher "Habis" state) — don't treat their absence as regressions. The Next.js snapshot/flag routes are an improvement.
