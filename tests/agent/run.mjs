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
const { createAgentToken, revokeAgentToken, listAgentTokens, applyProspectImport, importContentEvaluations, closePostgresConnection, listTicketPeople } = await import("./out/helpers.mjs");
// Content Evaluation & Instagram tables as in production (tests/imports/schema.sql), then migration 028.
const importSchema = readFileSync(new URL("../imports/schema.sql", import.meta.url), "utf8");
await sql.unsafe(importSchema.slice(importSchema.indexOf("create table content_evaluations"), importSchema.indexOf("create table free_class_eval")));
await sql.unsafe(migration("028_instagram_claude_sync.sql"));
// Customer Knowledge tables (labels as jsonb like production), then migration 029.
await sql`create table pain_points (id uuid primary key default gen_random_uuid(), komentar text, platform text, kategori text, username text, bulan text, source_url text, notes text, labels jsonb default '[]', created_at timestamptz default now())`;
await sql`create table pain_point_platforms (id uuid primary key default gen_random_uuid(), nama text)`;
await sql`create table pain_point_categories (id uuid primary key default gen_random_uuid(), nama text)`;
await sql.unsafe(migration("029_customer_knowledge_claude.sql"));
const CK = await import("./out/ck-route.mjs");
// Competitor Intel tables (JSON columns as jsonb like production), then migration 030.
await sql`create table competitor_profiles (id uuid primary key default gen_random_uuid(), name text, category text, platforms jsonb default '[]', primary_url text, niche text, target_audience text, followers jsonb default '{}', threat_level text, logo_url text, notes text, created_at timestamptz default now())`;
await sql`create table competitor_snapshots (id uuid primary key default gen_random_uuid(), competitor_id uuid, snapshot_date date, threat_level text, followers jsonb default '{}', ads_active boolean default false, notes text)`;
await sql`create table competitor_flags (id uuid primary key default gen_random_uuid(), competitor_id uuid, flag_type text, flag_date date, description text)`;
await sql`create table competitor_products (id uuid primary key default gen_random_uuid(), competitor_id uuid, name text, category text, description text, price_min numeric, price_max numeric, status text, features jsonb default '[]', links jsonb default '[]', image_url text, image_urls jsonb default '[]', created_at timestamptz default now())`;
await sql`create table competitor_product_prices (id uuid primary key default gen_random_uuid(), product_id uuid, price_min numeric, price_max numeric, recorded_at date, notes text)`;
await sql.unsafe(migration("030_competitor_claude.sql"));
const CI = await import("./out/ci-route.mjs");
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

// ── Job Vacancy MT: selection steps ──
const mt2 = await createAgentToken({ name: "Riset MT 2", modules: ["job-vacancy-mt"], createdBy: "Admin" });
r = await call({ mode: "apply", companies: [{ brand: "Pyridam Farma", selection_steps: [{ program: "Pyridam MT", text: "Administrasi → Psikotes → Interview HR → MCU", source_url: "https://example.com/steps" }] }] }, mt2.key);
const [stepRow] = await sql`select kind, origin, details from mt_prospect_research where kind = 'steps'`;
ok(r.status === 200 && stepRow && stepRow.origin === "Claude" && stepRow.details.steps.includes("Psikotes") && stepRow.details["Added by"] === "Claude (Riset MT 2)", "MT: selection steps are added as a Claude note");

// ── Customer Knowledge ──
await sql`insert into pain_point_platforms (nama) values ('Instagram'), ('TikTok'), ('X')`;
await sql`insert into pain_point_categories (nama) values ('Karier'), ('Psikotes')`;
await sql`insert into pain_points (komentar, platform, kategori, bulan, notes, labels) values ('Susah cari loker!!', 'Instagram', 'Karier', 'Okt', 'Ditulis tim', '["Fresh grad"]')`;
const ck = await createAgentToken({ name: "Riset CK", modules: ["customer-knowledge"], createdBy: "Admin" });
const ckCall = async (body, key = ck.key) => { const res = await CK.POST(new Request("http://x/api/agent/customer-knowledge", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: JSON.stringify(body) })); return { status: res.status, body: await res.json() }; };
ok((await ckCall({ mode: "preview", pain_points: [{ comment: "x" }] }, ig.key)).status === 401, "CK: a key for another module → 401");
const guide = await (await CK.GET(new Request("http://x/api/agent/customer-knowledge", { headers: { authorization: `Bearer ${ck.key}` } }))).json();
ok(guide.module === "Customer Knowledge" && guide.platforms.join() === "Instagram,TikTok,X" && guide.categories.join() === "Karier,Psikotes", "CK: GET explains the format and lists platforms and categories");
const pains = [
  { comment: "Psikotes BUMN bikin stres", platform: "tiktok", category: "psikotes", month: "2026-10-03", username: "@budi", source_url: "https://tiktok.com/@x/video/1", labels: ["BUMN"] },
  { comment: "susah cari loker", platform: "Instagram", category: "Karier", month: 10, username: "rina", notes: "Dari Claude", labels: ["Fresh grad", "Loker"] },
  { comment: "Gaji MT kecil", platform: "Facebook", category: "Karier", month: 10 },
];
r = await ckCall({ mode: "preview", pain_points: pains });
ok(r.status === 200 && r.body.summary.added === 1 && r.body.summary.updated === 1 && r.body.summary.invalid === 1 && /Use one of/.test(r.body.items[2].errors[0]), `CK preview: 1 new, 1 update, 1 invalid with the allowed list (${JSON.stringify(r.body.summary)})`);
ok((await sql`select count(*)::int as n from pain_points`)[0].n === 1, "CK preview changes nothing");
r = await ckCall({ mode: "apply", pain_points: pains });
const [fresh2] = await sql`select platform, kategori, bulan, username, labels, added_via, added_at from pain_points where komentar = 'Psikotes BUMN bikin stres'`;
ok(r.status === 200 && fresh2 && fresh2.platform === "TikTok" && fresh2.kategori === "Psikotes" && fresh2.bulan === "Okt" && fresh2.labels[0] === "BUMN" && fresh2.added_via === "Claude (Riset CK)" && fresh2.added_at, "CK apply: new pain point in the module's words, marked Added by Claude");
const [old2] = await sql`select kategori, username, notes, labels, added_via from pain_points where komentar = 'Susah cari loker!!'`;
ok(old2.kategori === "Karier" && old2.username === "rina" && old2.notes === "Ditulis tim" && old2.labels.join() === "Fresh grad,Loker" && !old2.added_via, "CK apply: same comment not added twice — empty username filled, team notes kept, new label added");
r = await ckCall({ mode: "apply", pain_points: pains });
ok(r.body.summary.added === 0 && r.body.summary.updated === 0 && (await sql`select count(*)::int as n from pain_points`)[0].n === 2, "CK: applying again adds nothing twice");
ok((await sql`select 1 from activity_log where module = 'Customer Knowledge' and user_name = 'Claude (Riset CK)'`).length === 2, "CK: every apply is in the activity log");
await sql`alter table pain_points add column labels_list text[]`;
await sql`update pain_points set labels_list = array(select jsonb_array_elements_text(labels))`;
await sql`alter table pain_points drop column labels`;
await sql`alter table pain_points rename column labels_list to labels`;
await closePostgresConnection(); // the app's pooled statements were planned for the old column type
r = await ckCall({ mode: "apply", pain_points: [{ comment: "Interview user susah", platform: "X", category: "Karier", month: "Nov", labels: ["Interview"] }] });
ok(r.status === 200 && (await sql`select labels from pain_points where komentar = 'Interview user susah'`)[0].labels[0] === "Interview", "CK: labels saved also where the column is a text list");
globalThis.__session = { user: { id: "u1", name: "Tester" } };
ok((await CK.POST(new Request("http://internal.test/api/agent/customer-knowledge", { method: "POST", headers: { host: "internal.test", origin: "http://internal.test" }, body: JSON.stringify({ mode: "preview", pain_points: pains }) }))).status === 200, "CK: Claude in Chrome on the app's page can preview with the session");
globalThis.__session = null;

// ── Competitor Intel ──
const [kerjaku] = await sql`insert into competitor_profiles (name, category, platforms, niche, threat_level, notes, followers) values ('Kerjaku Academy', 'direct', '["Instagram"]', 'MT test prep', 'medium', 'Ditulis tim', '{"Instagram": 50000}') returning id`;
await sql`insert into competitor_flags (competitor_id, flag_type, flag_date, description) values (${kerjaku.id}, 'new_campaign', '2026-10-02', 'Promo 10.10')`;
const [boot] = await sql`insert into competitor_products (competitor_id, name, category, price_min, price_max, features) values (${kerjaku.id}, 'Bootcamp MT', 'Kelas', 300000, 300000, '["Psikotes"]') returning id`;
await sql`insert into competitor_product_prices (product_id, price_min, price_max, recorded_at) values (${boot.id}, 300000, 300000, '2026-10-01')`;
const ci = await createAgentToken({ name: "Riset kompetitor", modules: ["competitor-intel"], createdBy: "Admin" });
const ciCall = async (body, key = ci.key) => { const res = await CI.POST(new Request("http://x/api/agent/competitor-intel", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: JSON.stringify(body) })); return { status: res.status, body: await res.json() }; };
ok((await ciCall({ mode: "preview", competitors: [{ name: "X" }] }, ck.key)).status === 401, "CI: a key for another module → 401");
ok((await (await CI.GET(new Request("http://x/api/agent/competitor-intel", { headers: { authorization: `Bearer ${ci.key}` } }))).json()).module === "Competitor Intel", "CI: GET explains the format");
const comps = [
  { name: "kerjaku academy", primary_url: "https://kerjaku.id", niche: "Career coaching", threat_level: "high", followers: { Instagram: 52000, TikTok: 9000 }, ads_active: true,
    flags: [{ type: "new_campaign", date: "2026-10-02", description: "promo 10.10" }, { type: "price_change", date: "2026-10-24", description: "Bootcamp naik jadi 350K", source_url: "https://kerjaku.id/bootcamp" }],
    products: [{ name: "bootcamp mt", price_min: 350000, price_date: "2026-10-24", features: ["Interview"] }, { name: "Kelas Psikotes", category: "Kelas", price: 150000 }] },
  { name: "Lolos MT", category: "substitute", platforms: ["Instagram"], followers: { Instagram: 8000 }, products: [{ name: "Tryout BUMN", price: 99000 }] },
  { name: "Kerjaku" },
];
r = await ciCall({ mode: "preview", competitors: comps });
const cs = r.body.summary;
ok(r.status === 200 && cs.added === 1 && cs.updated === 1 && cs.possibleDuplicates === 1 && cs.flagsAdded === 1 && cs.productsAdded === 2 && cs.productsUpdated === 1 && cs.pricesAdded === 3, `CI preview: 1 new, 1 update, 1 possible duplicate, 1 new flag, 2 new products, 1 new price on an old product (${JSON.stringify(cs)})`);
ok(r.body.items[0].conflicts.map((c) => c.field).join() === "niche,threat_level", "CI preview: different niche and threat are conflicts, not written");
ok((await sql`select count(*)::int as n from competitor_profiles`)[0].n === 1, "CI preview changes nothing");
r = await ciCall({ mode: "apply", competitors: comps });
const [k] = await sql`select * from competitor_profiles where id = ${kerjaku.id}`;
ok(r.status === 200 && k.primary_url === "https://kerjaku.id" && k.niche === "MT test prep" && k.threat_level === "medium" && k.notes === "Ditulis tim", "CI apply: empty URL filled; niche, threat and team notes kept");
ok(k.followers.Instagram === 52000 && k.followers.TikTok === 9000 && k.platforms.join() === "Instagram,TikTok", "CI apply: newest followers per platform, platform added");
const snaps2 = await sql`select followers, ads_active from competitor_snapshots where competitor_id = ${kerjaku.id}`;
ok(snaps2.length === 1 && snaps2[0].followers.TikTok === 9000 && snaps2[0].ads_active === true, "CI apply: today's snapshot keeps the follower history and ads active");
const flags2 = await sql`select flag_type, description, added_via from competitor_flags where competitor_id = ${kerjaku.id} order by flag_date`;
ok(flags2.length === 2 && flags2[1].flag_type === "price_change" && flags2[1].description.includes("https://kerjaku.id/bootcamp") && flags2[1].added_via === "Claude (Riset kompetitor)", "CI apply: known flag skipped, new flag added with its source, marked Added by Claude");
const bootPrices = await sql`select price_min::int as p, to_char(recorded_at, 'YYYY-MM-DD') as d from competitor_product_prices where product_id = ${boot.id} order by recorded_at`;
const [boot2] = await sql`select price_min::int as p, features from competitor_products where id = ${boot.id}`;
ok(bootPrices.map((x) => `${x.d}:${x.p}`).join() === "2026-10-01:300000,2026-10-24:350000" && boot2.p === 300000 && boot2.features.join() === "Psikotes,Interview", "CI apply: new price kept as a dated price, old price stays, feature added");
const [psi] = await sql`select category, price_min::int as p, added_via from competitor_products where name = 'Kelas Psikotes'`;
ok(psi && psi.category === "Kelas" && psi.p === 150000 && psi.added_via === "Claude (Riset kompetitor)", "CI apply: new product with price, marked Added by Claude");
const [lolos] = await sql`select category, added_via from competitor_profiles where name = 'Lolos MT'`;
ok(lolos && lolos.category === "substitusi" && lolos.added_via === "Claude (Riset kompetitor)" && (await sql`select count(*)::int as n from competitor_profiles where name = 'Kerjaku'`)[0].n === 0, "CI apply: new competitor added (substitute), possible duplicate not added");
r = await ciCall({ mode: "apply", competitors: comps });
ok(r.body.summary.added === 0 && r.body.summary.flagsAdded === 0 && r.body.summary.productsAdded === 0 && r.body.summary.pricesAdded === 0 && (await sql`select count(*)::int as n from competitor_snapshots`)[0].n === 2, `CI: applying again adds nothing twice (${JSON.stringify(r.body.summary)})`);
r = await ciCall({ mode: "apply", competitors: [{ name: "Kerjaku", match_id: String(kerjaku.id), notes: "x" }, { name: "Kerjaku Pro", as_new: true }] });
ok(r.body.summary.updated === 0 && r.body.summary.unchanged === 1 && r.body.summary.added === 1, "CI: match_id updates that competitor (filled notes stay), as_new adds a new one");
ok((await sql`select 1 from activity_log where module = 'Competitor Intel'`).length === 3, "CI: every apply is in the activity log");
globalThis.__session = { user: { id: "u1", name: "Tester" } };
ok((await CI.POST(new Request("http://internal.test/api/agent/competitor-intel", { method: "POST", headers: { host: "internal.test", origin: "http://internal.test" }, body: JSON.stringify({ mode: "preview", competitors: comps }) }))).status === 200, "CI: Claude in Chrome on the app's page can preview with the session");
globalThis.__session = null;

// ── Blocked accounts are marked on ticket people (pickers hide them) ──
await sql`create table if not exists auth_users (id uuid primary key default gen_random_uuid(), email text, name text, role text, password_hash text, is_active boolean default true, created_at timestamptz default now())`;
await sql`create table if not exists tkt_people (id uuid primary key default gen_random_uuid(), nama text, email text, divisi_id uuid, level text, auth_user_id uuid)`;
const [ariel] = await sql`insert into auth_users (email, name, is_active) values ('arielmischaa@gmail.com', 'ariel', false) returning id`;
const [rina] = await sql`insert into auth_users (email, name, is_active) values ('rina@x.id', 'Rina', true) returning id`;
await sql`insert into auth_users (email, name, is_active) values ('achbarfalah14@gmail.com', 'falah', false)`;
await sql`insert into tkt_people (nama, email, auth_user_id) values ('ariel', 'arielmischaa@gmail.com', ${ariel.id}), ('Rina', 'rina@x.id', ${rina.id}), ('Falah Akbar', ' AchbarFalah14@gmail.com', null), ('Tamu', 'tamu@x.id', null)`;
const peopleRows = await listTicketPeople();
const flag = Object.fromEntries(peopleRows.map((row) => [row.nama, row.blocked]));
ok(flag.ariel === true && flag["Falah Akbar"] === true && flag.Rina === false && flag.Tamu === false, `people: blocked by linked account or by email; others not (${JSON.stringify(flag)})`);

// ── Server action failures reach the person (production hides thrown messages) ──
const { createManagedRecord, createManagedRecordClient } = await import("./out/records.mjs");
await sql`create table if not exists resources (id uuid primary key default gen_random_uuid(), tipe text not null, kategori text not null, nama text not null, url text, email text, username text, password text, notes text, urutan integer, created_at timestamptz default now())`;
globalThis.__session = { user: { id: "u1", name: "Tester", role: "admin" } };
const form = (fields) => { const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.set(k, v); return fd; };
let actionResult = await createManagedRecord("resources", form({ kategori: "Account", nama: "Github" }));
const [gh] = await sql`select tipe from resources where nama = 'Github'`;
ok(actionResult === undefined && gh?.tipe === "link", "resources: Type left empty becomes \"link\" and the resource is added");
actionResult = await createManagedRecord("resources", form({ nama: "Tanpa kategori" }));
ok(actionResult && actionResult.__actionError === "Category is required.", `a database rule comes back as a sentence, not a thrown error (${JSON.stringify(actionResult)})`);
let thrown = "";
try { await createManagedRecordClient("resources", form({ nama: "Tanpa kategori" })); } catch (error) { thrown = error.message; }
ok(thrown === "Category is required.", "the browser wrapper turns it into an Error with that message");
globalThis.__session = null;
actionResult = await createManagedRecord("resources", form({ kategori: "Account", nama: "X" }));
ok(actionResult && actionResult.__actionError === "Unauthorized", "signed out: the message comes back too");

// ── Changes made offline reach the server (Putaran 55) ──
await sql.unsafe(migration("004_ticket_notifications_and_pwa.sql")).catch(async () => { await sql`create table if not exists ticket_notifications (id uuid primary key default gen_random_uuid(), ticket_id uuid, actor_user_id text, actor_name text, event_type text, title text, message text, target_roles text[], created_at timestamptz default now())`; });
await sql`create table if not exists tickets (id uuid primary key default gen_random_uuid(), ticket_no text, title text, description text, status text default 'Todo', priority text default 'Med', type_id uuid, divisi_id uuid, assigned_to_id uuid, assigned_to_ids uuid[] default '{}', requester_id uuid, due_date date, cc text[] default '{}', links jsonb default '[]', files jsonb default '[]', komentar jsonb default '[]', notification_roles text[] default '{admin}', source text, gcal_added boolean default false, related_task_id uuid, created_at timestamptz default now())`;
const { applyOfflineChangeAction } = await import("./out/offline.mjs");
globalThis.__session = { user: { id: "u1", name: "Tester", role: "admin" } };
const [tk] = await sql`insert into tickets (title, status, priority, due_date, cc) values ('Cetak banner', 'Todo', 'Med', '2026-10-30', '{a@x.id}') returning id`;
let replay = await applyOfflineChangeAction({ kind: "ticket", id: tk.id, before: { status: "Todo" }, after: { status: "Done" } });
let [tkNow] = await sql`select status, priority from tickets where id = ${tk.id}`;
ok(replay?.result === "applied" && tkNow.status === "Done", `offline: status change applied (${JSON.stringify(replay)})`);
replay = await applyOfflineChangeAction({ kind: "ticket", id: tk.id, before: { status: "Todo" }, after: { status: "Done" } });
ok(replay?.result === "already", "offline: the same change sent twice is not a conflict");
await sql`update tickets set priority = 'High' where id = ${tk.id}`;
replay = await applyOfflineChangeAction({ kind: "ticket", id: tk.id, before: { title: "Cetak banner", due_date: "2026-10-30" }, after: { title: "Cetak banner A1", due_date: "2026-11-02" } });
[tkNow] = await sql`select title, priority, status, to_char(due_date, 'YYYY-MM-DD') as due, cc from tickets where id = ${tk.id}`;
ok(replay?.result === "applied" && tkNow.title === "Cetak banner A1" && tkNow.due === "2026-11-02" && tkNow.priority === "High" && tkNow.status === "Done" && tkNow.cc.join() === "a@x.id", `offline: details applied, another person's Priority and CC kept (${JSON.stringify(tkNow)})`);
await sql`update tickets set status = 'In Progress' where id = ${tk.id}`;
replay = await applyOfflineChangeAction({ kind: "ticket", id: tk.id, before: { status: "Done" }, after: { status: "Todo" } });
[tkNow] = await sql`select status from tickets where id = ${tk.id}`;
ok(replay?.result === "conflict" && replay.conflicts[0].now === "In Progress" && tkNow.status === "In Progress", "offline: someone changed the same field → conflict, nothing overwritten");
replay = await applyOfflineChangeAction({ kind: "ticket", id: tk.id, before: { status: "Done" }, after: { status: "Todo" } }, true);
[tkNow] = await sql`select status from tickets where id = ${tk.id}`;
ok(replay?.result === "applied" && tkNow.status === "Todo", "offline: Keep my change saves over it");
replay = await applyOfflineChangeAction({ kind: "ticket", id: "00000000-0000-4000-8000-000000000000", before: { status: "Todo" }, after: { status: "Done" } });
ok(replay?.result === "missing", "offline: a deleted ticket is reported, not an error");
replay = await applyOfflineChangeAction({ kind: "ticket", id: tk.id, before: { status: "Todo" }, after: { status: "Nope" } });
ok(replay?.__actionError === "Invalid ticket status.", `offline: the same rules as an online save (${JSON.stringify(replay)})`);
replay = await applyOfflineChangeAction({ kind: "ticket", id: tk.id, before: {}, after: { cc: "evil@x.id" } });
ok(replay?.__actionError === "This change cannot be saved offline.", "offline: only the listed fields can be sent");
globalThis.__session = null;
replay = await applyOfflineChangeAction({ kind: "ticket", id: tk.id, before: { status: "Todo" }, after: { status: "Done" } });
ok(replay?.__actionError === "Unauthorized", "offline: signed out → nothing saved");

// ── Deletes: refused while still used, children go with the parent (Putaran 56) ──
const D = await import("./out/delete.mjs");
globalThis.__session = { user: { id: "u1", name: "Tester", role: "admin" } };
await sql`create table if not exists tkt_divisi (id uuid primary key default gen_random_uuid(), nama text, color text)`;
await sql`create table if not exists tkt_types (id uuid primary key default gen_random_uuid(), nama text, divisi_id uuid)`;
await sql`alter table tkt_people add column if not exists divisi_id uuid`;
await sql`create table if not exists tasks (id uuid primary key default gen_random_uuid(), project_id uuid, title text, status text, priority text, phase text, assignee_id uuid, assignee_ids uuid[] default '{}', due_date date, ticket_id uuid, created_at timestamptz default now())`;
await sql`create table if not exists carousel_plans (id uuid primary key default gen_random_uuid(), judul text, assignee_id uuid)`;
await sql`create table partners (id uuid primary key default gen_random_uuid(), name text)`;
await sql`create table partner_deals (id uuid primary key default gen_random_uuid(), partner_id uuid, title text)`;
await sql`create table partner_outreach (id uuid primary key default gen_random_uuid(), partner_id uuid, notes text)`;
await sql`create table products (id uuid primary key default gen_random_uuid(), nama text)`;
await sql`create table product_features (id uuid primary key default gen_random_uuid(), product_id uuid, nama text)`;
await sql`create table product_feature_links (id uuid primary key default gen_random_uuid(), feature_id uuid, url text)`;
await sql`create table product_bundles (id uuid primary key default gen_random_uuid(), bundle_id uuid, item_id uuid)`;
await sql`create table if not exists buyers (id uuid primary key default gen_random_uuid(), nama text)`;
await sql`create table if not exists crm_deals (id uuid primary key default gen_random_uuid(), buyer_id uuid, stage text)`;
const [divM] = await sql`insert into tkt_divisi (nama) values ('Marketing') returning id`;
const [divX] = await sql`insert into tkt_divisi (nama) values ('Kosong') returning id`;
const [p1] = await sql`insert into tkt_people (nama, email, divisi_id) values ('Tanpa Akun', 'ta@x.id', ${divM.id}) returning id`;
const [p2] = await sql`insert into tkt_people (nama, email) values ('Belum Dipakai', 'bd@x.id') returning id`;
const [acc] = await sql`insert into auth_users (email, name, is_active) values ('punya@x.id', 'Punya Akun', true) returning id`;
const [p3] = await sql`insert into tkt_people (nama, email, auth_user_id) values ('Punya Akun', 'punya@x.id', ${acc.id}) returning id`;
await sql`insert into tickets (title, assigned_to_ids, assigned_to_id) values ('T1', ${[p1.id]}::uuid[], ${p1.id}), ('T2', ${[p1.id]}::uuid[], null)`;
await sql`insert into tasks (title, assignee_ids) values ('Task 1', ${[p1.id]}::uuid[])`;
let del = "";
try { await D.deleteWithDependents("tkt_people", [p1.id]); } catch (error) { del = error.message; }
ok(del === "Still used by 2 tickets and 1 task. Change them first, then delete it." && (await sql`select 1 from tkt_people where id = ${p1.id}`).length === 1, `person on tickets/tasks: delete refused with where (${del})`);
const viaAction = await D.deleteManagedRecord("tkt_people", p1.id);
ok(viaAction?.__actionError?.startsWith("Still used by 2 tickets"), "the Settings delete gives the same message");
del = ""; try { await D.deleteWithDependents("tkt_people", [p3.id]); } catch (error) { del = error.message; }
ok(/Block the account in Users & roles instead/.test(del), "a person who can sign in: Block instead");
ok(await D.deleteWithDependents("tkt_people", [p2.id]) === 1, "an unused person is deleted");
let info = await D.describeDelete("tkt_divisi", [divM.id]);
ok(info.blocked === "Still used by 1 person. Change them first, then delete it.", `division with a member: refused (${info.blocked})`);
ok((await D.describeDelete("tkt_divisi", [divX.id])).blocked === "", "empty division: can be deleted");
await sql`insert into pain_point_platforms (nama) values ('Threads Uji'), ('Facebook')`;
await sql`insert into pain_points (komentar, platform, kategori) values ('x', 'threads uji ', 'Product')`;
const [igPlatform] = await sql`select id from pain_point_platforms where nama = 'Threads Uji'`;
const [fb] = await sql`select id from pain_point_platforms where nama = 'Facebook'`;
info = await D.describeDelete("pain_point_platforms", [igPlatform.id]);
ok(info.blocked === "Still used by 1 pain point. Change them first, then delete it.", "platform still on a pain point (name, any case): refused");
ok(await D.deleteWithDependents("pain_point_platforms", [fb.id]) === 1, "unused platform is deleted");
const [pt] = await sql`insert into partners (name) values ('PT A') returning id`;
await sql`insert into partner_deals (partner_id, title) values (${pt.id}, 'D1'), (${pt.id}, 'D2')`;
await sql`insert into partner_outreach (partner_id) values (${pt.id})`;
info = await D.describeDelete("partners", [pt.id]);
ok(info.also === "Also deletes 2 deals and 1 outreach log.", `partner confirm counts (${info.also})`);
await D.deleteManagedRecord("partners", pt.id);
const left = (await sql`select (select count(*) from partner_deals)::int + (select count(*) from partner_outreach)::int as n`)[0].n;
ok(left === 0, "partner deleted with its deals and outreach (no orphans)");
const [prodA] = await sql`insert into products (nama) values ('Kelas A') returning id`;
const [prodB] = await sql`insert into products (nama) values ('Bundle B') returning id`;
const [feat] = await sql`insert into product_features (product_id, nama) values (${prodA.id}, 'F') returning id`;
await sql`insert into product_feature_links (feature_id, url) values (${feat.id}, 'https://x'), (${feat.id}, 'https://y')`;
await sql`insert into product_bundles (bundle_id, item_id) values (${prodB.id}, ${prodA.id})`;
info = await D.describeDelete("products", [prodA.id]);
ok(info.blocked === "Still used by 1 bundle. Change them first, then delete it.", "product inside a bundle: refused");
info = await D.describeDelete("products", [prodB.id]);
ok(info.also === "Also deletes 1 bundle item.", `bundle confirm (${info.also})`);
await D.deleteWithDependents("products", [prodB.id]);
info = await D.describeDelete("products", [prodA.id]);
ok(info.blocked === "" && info.also === "Also deletes 1 feature and 2 shortlinks.", `then the product can go, with features and their shortlinks (${info.also})`);
await D.deleteWithDependents("products", [prodA.id]);
ok((await sql`select count(*)::int as n from product_feature_links`)[0].n === 0, "feature shortlinks deleted too (grandchildren)");
const [b1] = await sql`insert into buyers (nama) values ('Andi') returning id`;
await sql`insert into crm_deals (buyer_id, stage) values (${b1.id}, 'Lead')`;
const bulk = await D.bulkUpdateCrmBuyers([b1.id], "delete");
ok(bulk === undefined && (await sql`select count(*)::int as n from crm_deals`)[0].n === 0, "CRM bulk delete takes the buyer's deals too");

// ── Every account is a ticket person; requester; notifications to the ticket's audience (Putaran 57) ──
const PEOPLE = await import("./out/people.mjs");
await sql`create table if not exists ticket_notification_reads (notification_id uuid, user_id uuid, read_at timestamptz default now(), primary key (notification_id, user_id))`;
const [oldPerson] = await sql`insert into tkt_people (nama, email) values ('Dewi Lama', 'dewi@x.id') returning id`;
const dewi = await PEOPLE.createInternalUser({ email: "Dewi@x.id", name: "Dewi", role: "staff", password: "a-long-test-password" });
const dewiPeople = await sql`select id, auth_user_id from tkt_people where lower(email) = 'dewi@x.id'`;
ok(dewiPeople.length === 1 && String(dewiPeople[0].id) === String(oldPerson.id) && String(dewiPeople[0].auth_user_id) === String(dewi.id), "new account: linked to the person with the same email (no duplicate)");
const eko = await PEOPLE.createInternalUser({ email: "eko@x.id", name: "Eko", role: "lead", password: "a-long-test-password" });
const [ekoPerson] = await sql`select nama, level, auth_user_id from tkt_people where auth_user_id = ${eko.id}`;
ok(ekoPerson?.nama === "Eko" && ekoPerson.level === "lead", "new account without a person: one is added, level from role");
await sql`insert into auth_users (email, name, role, is_active) values ('fajar@x.id', 'Fajar', 'staff', true)`;
await sql.unsafe(migration("031_ticket_notification_people.sql"));
ok((await sql`select count(*)::int as n from tkt_people where email = 'fajar@x.id' and auth_user_id is not null`)[0].n === 1, "migration 031: an account added earlier gets its person");
await sql.unsafe(migration("031_ticket_notification_people.sql"));
ok((await sql`select count(*)::int as n from tkt_people where email = 'fajar@x.id'`)[0].n === 1, "migration 031 can run twice");
// Requester: the person who makes the ticket.
await sql`alter table tickets add column if not exists attachments jsonb default '[]'`;
await sql`alter table tickets alter column cc drop default, alter column cc type jsonb using to_jsonb(cc), alter column cc set default '[]'::jsonb`;
globalThis.__session = { user: { id: dewi.id, name: "Dewi", email: "dewi@x.id", role: "staff" } };
const made = await PEOPLE.createTicketAction({ title: "Minta desain", assignedToIds: [] });
ok(made && String(made.requester_id) === String(oldPerson.id), `Add ticket: the maker is the requester (${JSON.stringify(made?.__actionError || made?.requester_id)})`);
// Notifications: everyone who may see the ticket, not the maker, not a role.
const [admin] = await sql`insert into auth_users (email, name, role, is_active) values ('boss@x.id', 'Boss', 'admin', true) returning id`;
const [blockedAdmin] = await sql`insert into auth_users (email, name, role, is_active) values ('old@x.id', 'Old', 'admin', false) returning id`;
const [otherStaff] = await sql`insert into auth_users (email, name, role, is_active) values ('lain@x.id', 'Lain', 'staff', true) returning id`;
await sql`insert into tkt_people (nama, email, auth_user_id) values ('Lain', 'lain@x.id', ${otherStaff.id})`;
const [ekoPersonId] = await sql`select id from tkt_people where auth_user_id = ${eko.id}`;
const ticketRow = { id: made.id, requester_id: oldPerson.id, assigned_to_ids: [ekoPersonId.id] };
const note = await PEOPLE.publishTicketNotification({ ticketId: made.id, actorUserId: dewi.id, actorName: "Dewi", eventType: "created", title: "New ticket: Minta desain", message: "x", targetRoles: ["staff"], ticket: ticketRow });
const audience = (note?.target_user_ids || []).map(String).sort();
ok(audience.includes(String(admin.id)) && audience.includes(String(eko.id)) && !audience.includes(String(dewi.id)) && !audience.includes(String(otherStaff.id)) && !audience.includes(String(blockedAdmin.id)), "notification: admin + assignee, not the maker, not another staff, not a Blocked account");
const otherSees = await PEOPLE.listNotificationsForUser(String(otherStaff.id), "staff");
const ekoSees = await PEOPLE.listNotificationsForUser(String(eko.id), "lead");
ok(!otherSees.some((n) => n.title === "New ticket: Minta desain") && ekoSees.some((n) => n.title === "New ticket: Minta desain"), "the bell: the assignee sees it; a staff member with the same role as the maker does not");

// ── Access: ticket changes follow the board's visibility rule; system links; passwords; errors (Putaran 58) ──
const AX = await import("./out/access.mjs");
const [staffA] = await sql`insert into auth_users (email, name, role, is_active) values ('staffa@x.id', 'Staff A', 'staff', true) returning id`;
const [personA] = await sql`insert into tkt_people (nama, email, auth_user_id) values ('Staff A', 'staffa@x.id', ${staffA.id}) returning id`;
const [secret] = await sql`insert into tickets (title, status, priority, requester_id, assigned_to_ids) values ('Gaji tim', 'Todo', 'Med', ${oldPerson.id}, ${[oldPerson.id]}::uuid[]) returning id`;
const [mine] = await sql`insert into tickets (title, status, priority, requester_id, assigned_to_ids) values ('Punya A', 'Todo', 'Med', ${personA.id}, '{}') returning id`;
globalThis.__session = { user: { id: staffA.id, name: "Staff A", email: "staffa@x.id", role: "staff" } };
let ax = await AX.changeTicketStatusAction(secret.id, "Done");
ok(ax?.__actionError === "Ticket not found." && (await sql`select status from tickets where id = ${secret.id}`)[0].status === "Todo", "staff: another person's ticket can't be changed by id (answered as not found)");
ax = await AX.duplicateTicketAction(secret.id);
ok(ax?.__actionError === "Ticket not found.", "staff: can't copy (and read) a ticket they may not see");
ax = await AX.deleteTicketAction(secret.id);
ok(ax?.__actionError === "Ticket not found." && (await sql`select 1 from tickets where id = ${secret.id}`).length === 1, "staff: can't delete it either");
ax = await AX.changeTicketStatusAction(mine.id, "In Progress");
ok(ax === undefined && (await sql`select status from tickets where id = ${mine.id}`)[0].status === "In Progress", "staff: their own ticket still works");
const fd = new FormData(); fd.set("title", "Gaji tim"); fd.set("requester_id", personA.id);
ax = await AX.updateManagedRecord("tickets", secret.id, fd);
ok(ax?.__actionError === "Ticket not found." && String((await sql`select requester_id from tickets where id = ${secret.id}`)[0].requester_id) === String(oldPerson.id), "staff: can't make themselves requester of someone else's ticket");
const fd2 = new FormData(); fd2.set("title", "Punya A"); fd2.set("requester_id", oldPerson.id);
await AX.updateManagedRecord("tickets", mine.id, fd2);
ok(String((await sql`select requester_id from tickets where id = ${mine.id}`)[0].requester_id) === String(personA.id), "staff: the requester of their own ticket stays (only an admin changes it)");
// Resources: the password is fetched on demand, and that is logged.
await sql`insert into resources (tipe, kategori, nama, password) values ('credential', 'Akun', 'Canva', 'rahasia-123')`;
const [canva] = await sql`select id from resources where nama = 'Canva'`;
const before = (await sql`select count(*)::int as n from activity_log where module = 'Resources'`)[0].n;
ax = await AX.revealResourcePasswordAction(canva.id);
const after = (await sql`select count(*)::int as n from activity_log where module = 'Resources'`)[0].n;
ok(ax === "rahasia-123" && after === before + 1, "Resources: Show password returns it and logs who looked");
const fd3 = new FormData(); fd3.set("tipe", "credential"); fd3.set("kategori", "Akun"); fd3.set("nama", "Canva Pro"); fd3.set("password", "");
await AX.updateManagedRecord("resources", canva.id, fd3);
ok((await sql`select password from resources where id = ${canva.id}`)[0].password === "rahasia-123", "Resources: saving with Password left empty keeps the password");
// Server errors: kept for admins, grouped, emails masked.
await sql.unsafe(migration("032_app_errors.sql"));
await AX.recordServerError({ kind: "action", place: "saveThingAction", error: new Error('duplicate key for "rina@gmail.com" id 7f1c2d3e-0000-4000-8000-000000000001') });
await AX.recordServerError({ kind: "action", place: "saveThingAction", error: new Error('duplicate key for "budi@gmail.com" id 11111111-2222-4333-8444-555555555555') });
const failed = await AX.expected(async () => { throw new TypeError("x.map is not a function"); });
const errs = await AX.listServerErrors();
const dup = errs.find((e) => e.place === "saveThingAction");
ok(dup?.count === 2 && !/gmail/.test(dup.message) && /\[email\]/.test(dup.message), `errors: the same error is one row with a count, emails hidden (${dup?.count}, ${dup?.message})`);
ok(failed?.__actionError && errs.some((e) => e.kind === "action" && /x\.map is not a function/.test(e.message)), "errors: an unexpected bug in a save is recorded, the person gets the plain message");

await sql.end();
console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
