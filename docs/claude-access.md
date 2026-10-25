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
      "requirements": [{ "program": "MT 2026", "text": "S1 semua jurusan, IPK ≥ 3.00" }]
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

## Next modules

Customer Knowledge (pain points) follows the same pattern.
