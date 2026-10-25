# Claude access — adding research to internal.ccclub.id

Claude (in any chat, or a scheduled task) can add and update data in chosen modules. It can
never delete. Every change is previewed first and recorded in the activity log.

## Key

Settings → **Claude access** → **Add key** (admins only). Give it a name ("MT research") and the
modules it may update. The key (`ccc_…`) is shown **once** — paste it to Claude in the chat.
Revoke it in the same place to stop it at once. Only a hash of the key is stored.

## Without a key: Claude in Chrome

Claude in your own Chrome can use your session instead of a key — for **every** module below.
You sign in yourself; Claude never types a password.

1. Open any page of `https://internal.ccclub.id` in a tab where you are signed in.
2. Claude runs `fetch` **on that page** (Claude in Chrome → `javascript_tool`), so the request
   carries your session. Requests from other sites, or without an `Origin` header, are refused.

```js
const res = await fetch("/api/agent/instagram", {          // or "/api/agent/mt-prospects"
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "preview", posts: [/* … */] }),  // MT: companies: [/* … */]
});
return await res.json();
```

3. Claude shows you the summary. When you say yes, it sends the **same body** with
   `"mode": "apply"`. The activity log shows "Claude via <your name>".

## Job Vacancy MT

**Recommended: the Google Sheet.** Keep the "CCC List MT" in a Google Sheet; the app reads it every
hour (Job Vacancy MT → **Sync Google Sheet**, same tabs and rules as Import Excel). Claude edits
the sheet with the Google Drive connector — no key, no Chrome. Rules for Claude:

- Keep the tab names and the header row (row 1) exactly as they are: Aktif (MT 2026),
  Pernah Buka (2025), Lama (2024 saja), Prediksi 2026, Kontak HR, Syarat Gabungan,
  Update Tgl & Status, Tahapan Tambahan. Add rows; do not rename, reorder or delete columns.
- One company per row in its status tab. HR contacts, requirements, dated updates and selection
  steps go in their own tabs, naming the company by "Nama PT (legal)" and "Brand" exactly as in
  the company tab.
- Do not delete companies unless asked: a company removed from the sheet is removed from the app
  at the next sync (if many disappear at once the sync pauses until someone checks).
- With the sheet sync on, use the sheet only (not the API below), so every company has one home.

> Weekly MT research (sheet): every Monday, search the web for Management Trainee / ODP /
> graduate programmes in Indonesia opened or announced in the last 14 days. Update the
> "CCC List MT" Google Sheet with the Google Drive tools following docs/claude-access.md: new
> companies in "Aktif (MT 2026)", openings in the year columns, HR contacts in "Kontak HR",
> dated news with the source link in "Update Tgl & Status", requirements in "Syarat Gabungan",
> selection steps in "Tahapan Tambahan". Show me what you changed. The app picks it up within
> an hour.

### Without the sheet: the API

`GET https://internal.ccclub.id/api/agent/mt-prospects` — returns this format as JSON.

`POST https://internal.ccclub.id/api/agent/mt-prospects`
Header `Authorization: Bearer ccc_…`, body:

```json
{
  "mode": "preview",
  "companies": [
    {
      "brand": "Pyridam Farma",
      "legal_name": "PT Pyridam Farma Tbk",
      "industry": "Pharma",
      "program": "Pyridam Management Trainee",
      "openings": { "2026": { "months": "Maret–April", "dates": "10 Mar – 5 Apr" } },
      "contacts": [{ "name": "Budi", "title": "HR Manager", "link": "https://linkedin.com/in/…" }],
      "updates": [{ "date": "2026-10-20", "text": "Poster MT 2026 terbit", "source_url": "https://…" }],
      "requirements": [{ "program": "MT 2026", "text": "S1 semua jurusan, IPK ≥ 3.00" }],
      "selection_steps": [{ "program": "MT 2026", "text": "Administrasi → Psikotes → Interview HR → Interview User → MCU" }]
    }
  ]
}
```

1. Send `"mode": "preview"`. Show the person the summary, every `possible_duplicate` (with its
   `candidates`) and every `conflict`.
2. When they agree, send the same companies with `"mode": "apply"`. For a possible duplicate add
   `"match_id": "<candidate id>"` to update that company, or `"as_new": true` to add it as new.

Rules:

- Companies are matched by name like the Excel upload ("PT", "Tbk", "(Persero)" ignored).
- An existing company only gets its **empty** fields filled. A different value for a filled field
  is reported as a conflict and not written.
- Opening years, HR contacts and notes that are not there yet are added; duplicates are skipped.
- New companies are app companies, marked **Added by Claude**; an Excel upload keeps them. Notes
  added by Claude also stay after an Excel upload. Companies that came from the Excel file are
  refreshed by the next upload (the file stays the source for its own rows).
- Up to 200 companies per request.

### Weekly MT research through the API (prompt for Claude)

> Every Monday: search the web (career pages, LinkedIn, Instagram, job boards) for Management
> Trainee / ODP / graduate programmes in Indonesia opened or announced in the last 14 days. For
> each company give brand, legal name, industry, programme name, the opening (year, months,
> dates), HR contacts you can name, dated updates with the source link, requirements and
> selection steps. Open internal.ccclub.id in Chrome (I am signed in), run a fetch to
> `/api/agent/mt-prospects` with `mode: "preview"` (format: docs/claude-access.md), show me the
> summary with every possible duplicate and conflict, and send `mode: "apply"` after I agree.

## Instagram & Content Evaluation

`GET /api/agent/instagram` returns the full format as JSON. `POST /api/agent/instagram`:

```json
{
  "mode": "preview",
  "posts": [
    {
      "post_id": "18034567890123401",
      "url": "https://www.instagram.com/reel/…/",
      "posted_at": "2026-10-20",
      "format": "Reel",
      "caption": "Tips lolos MT …",
      "account_username": "careercclub",
      "views": 12000, "reach": 5400, "likes": 320, "comments": 18, "saves": 41, "shares": 27,
      "follows": 9, "profile_visits": 60, "link_taps": 4, "accounts_engaged": 380,
      "avg_watch_time_sec": 7.5, "watch_through_rate": 31, "duration_sec": 28
    }
  ],
  "weeks": [
    { "week_start": "2026-10-19", "followers_total": 15210, "follows_gained": 110, "reach": 9000,
      "views": 21000, "interactions": 1400, "link_clicks": 35, "profile_visits": 420 }
  ]
}
```

- `post_id` is the Instagram media id **as text** (long numbers lose digits). `posts` go to
  Content Evaluation, `weeks` (optional) to the Instagram page. Up to 100 posts and 60 weeks.
- Posts are matched by `post_id`, weeks by their Monday (any day of the week may be sent).
- Numbers from Instagram **replace** the old ones; fields you leave out stay as they are. URL,
  date, format and caption follow Instagram. A title someone typed and `followers_at_posting`
  are only filled while empty.
- Never changed: topic, hook rating, CTA, what worked, needs improvement, action, week notes.
- Rows show **Synced by Claude** with the date. The Meta CSV import keeps working on the same rows.

### Daily sync with Composio (prompt for the other Claude account)

> Every morning: with the Instagram tools in Composio, read the last 30 posts of our Instagram account
> with their insights (views, reach, likes, comments, saves, shares, follows, profile visits,
> link taps, accounts engaged; for Reels also average watch time and duration) and last
> week's account numbers. Open internal.ccclub.id in Chrome (I am signed in), run a fetch to
> `/api/agent/instagram` with `mode: "preview"` (format: docs/claude-access.md), show me the
> summary, and send the same body with `mode: "apply"` after I agree.

## Customer Knowledge (pain points)

**Recommended: the inbox Google Sheet** — fully automatic, no Chrome. A scheduled Claude task reads
DMs, TikTok comments and Threads replies with Composio and appends rows to the "Customer
Knowledge inbox" Google Sheet (also with Composio's Google Sheets tools); the app reads that sheet
every hour (Customer Knowledge → **Sync Google Sheet**).

Inbox sheet, one tab, row 1: `Date | Platform | Category | Comment | Username | Source link | Labels | Notes`

- Platform and Category must be exactly one of those in Customer Knowledge (the Sync Google Sheet
  dialog lists them). Rows that do not fit are skipped and listed in the app with their row number.
- Date: the date of the comment (YYYY-MM-DD). Labels: comma-separated (e.g. `DM, BUMN`).
- The same comment on the same platform is added once, so appending a comment twice is harmless.
- DMs are private: write only the question in the customer's words — no phone numbers, emails
  or other personal details; leave Username empty for DMs. Add the label `DM`.

> Daily Customer Knowledge (scheduled task, with Composio): every morning, collect what people
> asked us in the last 24 hours — Instagram DMs (Composio Instagram: list conversations and
> messages), comments on our TikTok videos (Composio Apify TikTok comments scraper, our latest
> 10 videos) and replies to our Threads posts. Skip greetings, spam and our own replies. For each
> message, pick the Platform and Category from this list: <paste from the Sync Google Sheet
> dialog>, and 1–3 short labels. Append one row per message to the "Customer Knowledge inbox"
> Google Sheet (Date, Platform, Category, Comment, Username, Source link, Labels, Notes) with
> Composio Google Sheets. For DMs: no username or personal details, label DM. Then tell me how
> many rows you added per platform.

### Without the sheet: the API

`GET /api/agent/customer-knowledge` returns the format **and the platforms and categories that
exist** (use exactly those). `POST /api/agent/customer-knowledge`:

```json
{
  "mode": "preview",
  "pain_points": [
    {
      "comment": "Psikotes BUMN bikin stres, ga ada latihan yang mirip",
      "platform": "TikTok",
      "category": "Psikotes",
      "month": "2026-10-03",
      "username": "@budi",
      "source_url": "https://www.tiktok.com/@…/video/…",
      "labels": ["BUMN", "Psikotes"]
    }
  ]
}
```

- `comment`, `platform`, `category` and `month` are required. Month may be 1–12, Okt / Oct, or
  the comment's date. Up to 200 per request.
- Platform and category must already exist in Customer Knowledge; otherwise the item is skipped
  and the answer lists the allowed ones (ask the person to add a new one first).
- The same comment (ignoring case, spaces and punctuation) on the same platform is not added
  twice; for it only an empty username / source / notes is filled and missing labels are added.
- New pain points show **Added by Claude**.

### Weekly pain-point research (prompt for Claude)

> Every Friday: collect 20–40 comments from Indonesian job seekers this week (Instagram, TikTok,
> X, forums) about job hunting, MT programmes, psychotests and interviews, in their own words.
> Get the platforms and categories from `GET /api/agent/customer-knowledge` on internal.ccclub.id
> (in Chrome, I am signed in), classify each comment, send `mode: "preview"`, show me the
> summary, and send `mode: "apply"` after I agree.

## Competitor Intel

`GET /api/agent/competitor-intel` returns the full format. `POST /api/agent/competitor-intel`:

```json
{
  "mode": "preview",
  "competitors": [
    {
      "name": "Kerjaku Academy",
      "category": "direct",
      "primary_url": "https://kerjaku.id",
      "platforms": ["Instagram", "TikTok"],
      "niche": "MT test prep",
      "target_audience": ["Fresh grad", "Jobseeker"],
      "followers": { "Instagram": 52000, "TikTok": 9000 },
      "ads_active": true,
      "flags": [{ "type": "price_change", "date": "2026-10-24", "description": "Bootcamp naik jadi 350K", "source_url": "https://…" }],
      "products": [{ "name": "Bootcamp MT", "category": "Kelas", "price_min": 350000, "price_date": "2026-10-24", "features": ["Psikotes", "Interview"], "links": ["https://…"] }]
    }
  ]
}
```

- Up to 50 competitors per request. `category`: direct, indirect or substitute. Flag `type`:
  new_product, price_change, new_campaign or other.
- Competitors are matched by name; a close but different name is a `possible_duplicate`
  (send `match_id` or `as_new`, like Job Vacancy MT).
- An existing competitor only gets its **empty** fields filled; a different value (niche,
  threat level, notes…) is a conflict and is not written. Threat level is the team's call.
- Followers: the newest number per platform wins, and each day keeps a snapshot (follower
  history). Platforms, features and links are only added.
- Flags are added once. Products are matched by name per competitor; a new price is kept as a
  dated price and the old prices stay.
- New competitors and products show **Added by Claude**.

### Weekly competitor check (prompt for Claude)

> Every Wednesday: for each competitor in Competitor Intel (and any new career-prep brand you
> find), check their website, Instagram, TikTok, YouTube and the Meta Ad Library: follower
> counts today, whether ads are running, new products or classes, price changes and new
> campaigns this week (with the source link). Open internal.ccclub.id in Chrome (I am signed
> in), run a fetch to `/api/agent/competitor-intel` with `mode: "preview"`, show me the summary
> with every possible duplicate and conflict, and send `mode: "apply"` after I agree.
