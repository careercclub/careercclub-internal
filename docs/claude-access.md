# Claude access — adding research to internal.ccclub.id

Claude (in any chat, or a scheduled task) can add and update data in chosen modules. It can
never delete. Every change is previewed first and recorded in the activity log.

## Key

Settings → **Claude access** → **Add key** (admins only). Give it a name ("MT research") and the
modules it may update. The key (`ccc_…`) is shown **once** — paste it to Claude in the chat.
Revoke it in the same place to stop it at once. Only a hash of the key is stored.

Without a key, Claude in your own signed-in browser (Claude in Chrome) can call the same
endpoints with your session.

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

## Next modules

Customer Knowledge (pain points) and Instagram / Content Evaluation follow the same pattern.
