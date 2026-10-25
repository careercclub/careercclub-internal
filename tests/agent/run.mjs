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
const { createAgentToken, revokeAgentToken, listAgentTokens, applyProspectImport } = await import("./out/helpers.mjs");
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
ok((await call({ mode: "preview", companies: [{ brand: "Kalbe" }] })).status === 200, "a signed-in browser session may call it too (Claude in Chrome)");
globalThis.__session = null;
const tokenId = (await listAgentTokens()).find((t) => t.name === "Riset MT").id;
await revokeAgentToken(tokenId);
ok((await call({ mode: "preview", companies: [{ brand: "X" }] }, mt.key)).status === 401, "a revoked key stops working at once");
ok((await listAgentTokens()).find((t) => t.id === tokenId).last_used_at, "last use is recorded");
await sql.end();
console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
