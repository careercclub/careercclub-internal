// Claude access → Job Vacancy MT against a real PostgreSQL: keys, preview/apply, merge rules.
import postgres from "postgres";
import { readFileSync } from "node:fs";
const URL_ = process.env.AGENT_TEST_DATABASE_URL;
if (!URL_) { console.error("Set AGENT_TEST_DATABASE_URL to a throwaway database (it is reset)."); process.exit(1); }
process.env.DATABASE_URL = URL_;
const sql = postgres(URL_, { onnotice: () => {} });
await sql.unsafe("drop schema public cascade; create schema public;");
const migration = (name) => readFileSync(new URL(`../../database/migrations/${name}`, import.meta.url), "utf8").replace(/^\s*(begin|commit);\s*$/gm, "");
await sql.unsafe(migration("025_mt_prospects.sql"));
await sql.unsafe(migration("027_claude_access.sql"));
// The app's activity log (made outside the migrations in production).
await sql`create table activity_log (id bigserial primary key, user_name text, module text, action text, detail text, created_at timestamptz default now())`;
const { POST, GET } = await import("./out/mt-route.mjs");
const IG = await import("./out/ig-route.mjs");
const { createAgentToken, revokeAgentToken, listAgentTokens, applyProspectImport, importContentEvaluations } = await import("./out/helpers.mjs");
// Content Evaluation & Instagram tables as in production (tests/imports/schema.sql), then migration 028.
const importSchema = readFileSync(new URL("../imports/schema.sql", import.meta.url), "utf8");
await sql.unsafe(importSchema.slice(importSchema.indexOf("create table content_evaluations"), importSchema.indexOf("create table free_class_eval")));
await sql.unsafe(migration("028_instagram_claude_sync.sql"));
let pass = 0, fail = 0; const ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); c ? pass++ : fail++; };
const call = async (body, key, method = "POST") => { const r = await (method === "POST" ? POST : GET)(new Request("http://x/api/agent/mt-prospects", { method, headers: key ? { authorization: `Bearer ${key}` } : {}, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) })); return { status: r.status, body: await r.json() }; };

globalThis.__session = null;
const [existing] = await sql`insert into mt_prospects (brand, legal_name, industry, program, status, source, import_key, openings) values ('Garudafood', 'PT Garudafood Putra Putri Jaya Tbk', 'FMCG', '', 'active', 'import', 'k-garuda', '{"2025": {"months": [8], "label": "Agustus", "dates": ""}}') returning id`;
const mt = await createAgentToken({ name: "Riset MT", modules: ["job-vacancy-mt"], createdBy: "Admin" });
const other = await createAgentToken({ name: "CK only", modules: ["customer-knowledge"], createdBy: "Admin" });
const stored = await sql`select token_hash, token_prefix from agent_tokens`;
ok(stored.every((row) => !String(row.token_hash).includes(mt.key.slice(4))) && stored.some((row) => mt.key.startsWith(row.token_prefix)), "only a hash and a prefix of the key are stored");

ok((await call({ mode: "preview", companies: [{ brand: "X" }] })).status === 401, "no key and no session → 401");
ok((await call({ mode: "preview", companies: [{ brand: "X" }] }, other.key)).status === 401, "a key for another module → 401");
ok((await call({}, mt.key, "GET")).body.module === "Job Vacancy MT", "GET explains the format to Claude");

const companies = [
  { brand: "PT Garudafood Putra Putri Jaya", industry: "Food", program: "Garudafood MT", openings: { 2025: { months: [9] }, 2026: { months: "Agustus" } }, contacts: [{ name: "Rina", title: "HR" }], updates: [{ date: "2026-10-20", text: "Poster MT 2026 terbit", source_url: "https://example.com/p" }] },
  { brand: "Pyridam Farma", industry: "Pharma", status: "active", openings: { 2026: { months: "Maret–April" } } },
  { brand: "Garuda Food" },
  { status: "open" },
];
let res = await call({ mode: "preview", companies }, mt.key);
const s = res.body.summary;
ok(res.status === 200 && s.added === 1 && s.updated === 1 && s.possibleDuplicates === 1 && s.invalid === 1, `preview: 1 new, 1 update, 1 possible duplicate, 1 invalid (${JSON.stringify(s)})`);
ok((await sql`select count(*)::int as n from mt_prospects`)[0].n === 1, "preview changes nothing");
const garuda = res.body.items[0];
ok(garuda.conflicts.some((c) => c.field === "industry") && garuda.set.program === "Garudafood MT", "preview: empty program filled, different industry reported as conflict");

res = await call({ mode: "apply", companies }, mt.key);
ok(res.status === 200 && res.body.summary.added === 1, "apply works with the key");
const [g] = await sql`select industry, program, openings from mt_prospects where id = ${existing.id}`;
ok(g.industry === "FMCG" && g.program === "Garudafood MT", "apply: filled the empty field, kept the filled one");
ok(g.openings["2025"].months[0] === 8 && g.openings["2026"].months[0] === 8, "apply: 2025 kept as it was, 2026 added");
const [p] = await sql`select source, added_via, status from mt_prospects where brand = 'Pyridam Farma'`;
ok(p.source === "manual" && p.added_via === "claude", "new company is an app company marked Added by Claude");
ok((await sql`select count(*)::int as n from mt_prospects where brand = 'Garuda Food'`)[0].n === 0, "possible duplicate was not added");
const notes = await sql`select details from mt_prospect_research where origin = 'Claude'`;
ok(notes.length === 1 && notes[0].details.Note === "Poster MT 2026 terbit" && notes[0].details["Added by"] === "Claude (Riset MT)", "dated note added, signed by the key's name");
res = await call({ mode: "apply", companies }, mt.key);
ok((await sql`select user_name, action from activity_log where module = 'Job Vacancy MT'`).some((row) => row.user_name === "Claude (Riset MT)" && row.action === "Claude update"), "every apply is in the activity log under the key's name");
ok(res.body.summary.notesAdded === 0 && res.body.summary.contactsAdded === 0 && res.body.summary.added === 0, "applying again adds nothing twice");
const keepCount = (await sql`select count(*)::int as n from mt_prospect_research where origin = 'Claude'`)[0].n;
await applyProspectImport({ prospects: [{ importKey: "k-garuda", legalName: "PT Garudafood Putra Putri Jaya Tbk", brand: "Garudafood", status: "active", industry: "FMCG", program: "", activeYears: "", totalOpenings: null, usualMonths: [], openings: {}, prediction: null, notes: "", exclusionReason: "" }], contacts: [], research: [], unmatched: [], skippedNotes: 0, missingSheets: [] }, { fileName: "list.xlsx", importedBy: "Admin" });
ok((await sql`select count(*)::int as n from mt_prospect_research where origin = 'Claude'`)[0].n === keepCount && (await sql`select count(*)::int as n from mt_prospects where brand = 'Pyridam Farma'`)[0].n === 1, "a later Excel upload keeps Claude's notes and Claude's companies");

globalThis.__session = { user: { id: "u1", name: "Tester" } };
const browser = async (body, origin) => (await POST(new Request("http://internal.test/api/agent/mt-prospects", { method: "POST", headers: { host: "internal.test", "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body) }))).status;
ok(await browser({ mode: "preview", companies: [{ brand: "Kalbe" }] }, "http://internal.test") === 200, "a signed-in browser session on the app's own page may call it (Claude in Chrome)");
ok(await browser({ mode: "preview", companies: [{ brand: "Kalbe" }] }, "https://evil.example") === 401 && await browser({ mode: "preview", companies: [{ brand: "Kalbe" }] }) === 401, "a session from another site (or with no Origin) is refused");
globalThis.__session = null;
const tokenId = (await listAgentTokens()).find((t) => t.name === "Riset MT").id;
await revokeAgentToken(tokenId);
ok((await call({ mode: "preview", companies: [{ brand: "X" }] }, mt.key)).status === 401, "a revoked key stops working at once");
ok((await listAgentTokens()).find((t) => t.id === tokenId).last_used_at, "last use is recorded");

// ── Instagram & Content Evaluation ──
const ig = await createAgentToken({ name: "IG sync", modules: ["instagram"], createdBy: "Admin" });
const igCall = async (body, key = ig.key) => { const r = await IG.POST(new Request("http://x/api/agent/instagram", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: JSON.stringify(body) })); return { status: r.status, body: await r.json() }; };
ok((await igCall({ mode: "preview", posts: [{ post_id: "1" }] }, other.key)).status === 401, "IG: a key for another module → 401");
ok((await IG.GET(new Request("http://x/api/agent/instagram", { headers: { authorization: `Bearer ${ig.key}` } })).then((r) => r.json())).module === "Instagram & Content Evaluation", "IG: GET explains the format");
await sql`insert into content_evaluations (post_id, judul, url, format, tanggal, reach, likes, wtr, topik, win, improve, action, hook_rating) values ('18034567890123401', 'Judul tim', 'https://www.instagram.com/p/AAA/', 'Carousel', '2026-10-20', 800, 50, 42, 'Tips CV', 'Hook kuat', 'CTA lemah', 'Boost ke Meta Ads', 4)`;
await sql`insert into ig_snapshots (week_start, followers_total, reach, notes) values ('2026-10-19', 15100, 9000, 'Minggu webinar')`;
const posts = [
  { post_id: "18034567890123401", reach: 950, likes: 61, caption: "Caption dari IG", title: "Judul Claude" },
  { post_id: "18099999999999999", url: "https://www.instagram.com/reel/BBB/", posted_at: "2026-10-22", media_type: "VIDEO", caption: "Tips lolos MT", reach: 5400, views: 12000, saves: 41 },
  { post_id: 18034567890123401 },
];
const weeks = [{ week_start: "2026-10-22", followers_total: 15210 }, { week_start: "2026-10-26", reach: 3000, views: 7000 }];
let r = await igCall({ mode: "preview", posts, weeks });
ok(r.status === 200 && r.body.summary.postsAdded === 1 && r.body.summary.postsUpdated === 1 && r.body.summary.postsInvalid === 1 && r.body.summary.weeksUpdated === 1 && r.body.summary.weeksAdded === 1, `IG preview: 1 new post, 1 update, 1 invalid, 1 week updated, 1 new week (${JSON.stringify(r.body.summary)})`);
ok(r.body.posts[0].changes.some((c) => c.field === "reach" && c.from == 800 && c.to === 950), "IG preview lists what changes (reach 800 → 950)");
ok((await sql`select count(*)::int as n from content_evaluations`)[0].n === 1 && (await sql`select reach from content_evaluations where post_id = '18034567890123401'`)[0].reach == 800, "IG preview changes nothing");
r = await igCall({ mode: "apply", posts, weeks });
const [old] = await sql`select * from content_evaluations where post_id = '18034567890123401'`;
ok(r.status === 200 && old.reach == 950 && old.likes == 61 && old.description === "Caption dari IG", "IG apply: newest numbers and caption written");
ok(old.judul === "Judul tim" && old.wtr == 42 && old.topik === "Tips CV" && old.win === "Hook kuat" && old.improve === "CTA lemah" && old.action === "Boost ke Meta Ads" && old.hook_rating == 4, "IG apply: typed title, unsent numbers and the team's own notes are untouched");
ok(old.synced_by === "Claude (IG sync)" && old.synced_at, "IG apply: row marked Synced by Claude with the time");
const [fresh] = await sql`select judul, format, to_char(tanggal, 'YYYY-MM-DD') as tanggal, views from content_evaluations where post_id = '18099999999999999'`;
ok(fresh && fresh.judul === "Tips lolos MT" && fresh.format === "Reel" && fresh.tanggal === "2026-10-22" && fresh.views == 12000, "IG apply: new post added with title from caption, Reel, date");
const [week] = await sql`select followers_total, reach, notes, synced_by from ig_snapshots where week_start = '2026-10-19'`;
ok(week.followers_total === 15210 && week.reach === 9000 && week.notes === "Minggu webinar" && week.synced_by === "Claude (IG sync)", "IG apply: week numbers replaced, other numbers and notes kept");
ok((await sql`select count(*)::int as n from ig_snapshots where week_start = '2026-10-26'`)[0].n === 1, "IG apply: new week added on its Monday");
r = await igCall({ mode: "apply", posts, weeks });
ok(r.body.summary.postsAdded === 0 && r.body.summary.postsUpdated === 0 && r.body.summary.postsUnchanged === 2 && (await sql`select count(*)::int as n from content_evaluations`)[0].n === 2, "IG: applying again adds nothing twice");
ok((await sql`select user_name from activity_log where module = 'Content Evaluation' and action = 'Claude sync'`).length === 2, "IG: every apply is in the activity log");
await importContentEvaluations([{ postId: "18099999999999999", accountId: "", accountUsername: "", description: "Tips lolos MT", title: "Tips lolos MT", url: "https://www.instagram.com/reel/BBB/", format: "Reel", date: "2026-10-22", views: 13000, reach: 5600, likes: null, comments: null, saves: 41, shares: null, follows: null, duration: null, nfPct: null, fromHome: null, fromProfile: null, fromOther: null, engaged: null, profileVisits: null, linkTaps: null, watchtime: null, wtr: null, replays: null, dropoff: null, tapsForward: null, tapsBack: null, exits: null, replies: null, stickersInteract: null }]);
ok((await sql`select count(*)::int as n from content_evaluations`)[0].n === 2 && (await sql`select views from content_evaluations where post_id = '18099999999999999'`)[0].views == 13000, "IG: the Meta CSV import still updates the same post (no duplicate)");
ok((await igCall({ mode: "preview", posts: Array.from({ length: 101 }, (_, i) => ({ post_id: String(i) })) })).status === 400, "IG: more than 100 posts → 400");
globalThis.__session = { user: { id: "u1", name: "Tester" } };
const igBrowser = await IG.POST(new Request("http://internal.test/api/agent/instagram", { method: "POST", headers: { host: "internal.test", origin: "http://internal.test" }, body: JSON.stringify({ mode: "preview", posts: [{ post_id: "5", reach: 1 }] }) }));
ok(igBrowser.status === 200, "IG: Claude in Chrome on the app's page can preview with the session");
globalThis.__session = null;

await sql.end();
console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
