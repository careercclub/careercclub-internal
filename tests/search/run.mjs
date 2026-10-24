// Real searchEverything against a throwaway Postgres whose tables are made from the search specs.
import postgres from "postgres";
const URL = process.env.SEARCH_TEST_DATABASE_URL;
if (!URL) { console.error("Set SEARCH_TEST_DATABASE_URL to a throwaway database (its search tables are recreated)."); process.exit(1); }
process.env.DATABASE_URL = URL;
const { searchEverything, searchSpecs } = await import("./out/search.mjs");
const sql = postgres(URL, { onnotice: () => {} });
const withTrgm = process.argv[2] !== "no-trgm";
if (withTrgm) await sql`create extension if not exists pg_trgm`; else await sql`drop extension if exists pg_trgm`;
for (const spec of searchSpecs()) {
  const cols = [...new Set([...spec.fields.map((f) => f.name), ...(spec.key === "tickets" ? ["requester_id", "assigned_to_id", "assigned_to_ids"] : [])])];
  await sql.unsafe(`drop table if exists "${spec.table}" cascade; create table "${spec.table}" (id text primary key, ${cols.map((c) => `"${c}" ${c === "assigned_to_ids" ? "text[]" : "text"}`).join(", ")}${spec.table === "resources" ? ', "password" text' : ""})`);
}
await sql.unsafe(`create table if not exists "tkt_people" (id text primary key, nama text, email text, divisi_id text, auth_user_id text)`);
await sql`insert into resources (id, tipe, kategori, nama, url, email, username, password) values
  ('r1','credential','Account','Email CCC',null,'internal.careercclub@gmail.com',null,'rahasia-1'),
  ('r2','credential','Account','Canva',null,'career.cclub@gmail.com',null,'rahasia-2'),
  ('r3','link','Documents','Project Update CCC','https://ccclub.id/x',null,null,null),
  ('r4','link','Program & Product','Booklet CCA','https://ccclub.id/b',null,null,null),
  ('r5','link','Region','Jawa Barat network','https://ccclub.id/jb',null,null,null),
  ('r6','link','Program & Product','Passion points deck','https://ccclub.id/pp',null,null,null)`;
const ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) process.exitCode = 1; };
const q = async (text) => (await searchEverything(text, { role: "admin" })).hits;
let hits = await q("password");
ok(hits.some((h) => h.title === "Email CCC" && h.credential) && hits.some((h) => h.title === "Canva"), `"password" finds the logins (${hits.map((h) => h.title).join(", ")})`);
ok(!JSON.stringify(hits).includes("rahasia"), "no password value in any result");
hits = await q("akun canva");
ok(hits[0]?.title === "Canva", `"akun canva" → Canva first (${hits.map((h) => h.title).join(", ")})`);
hits = await q("canvaa");
ok(withTrgm ? hits[0]?.title === "Canva" && hits[0].close === true : hits.length === 0, `"canvaa" ${withTrgm ? "→ Canva as close match" : "→ nothing without pg_trgm"} (${hits.map((h) => h.title + (h.close ? "~" : "")).join(", ")})`);
hits = await q("boklet");
ok(withTrgm ? hits.some((h) => h.title === "Booklet CCA" && h.close) : true, `"boklet" → Booklet CCA (${hits.map((h) => h.title).join(", ")})`);
hits = await q("booklet");
ok(hits[0]?.title === "Booklet CCA" && !hits[0].close, "exact word is an exact (not close) hit");
hits = await q("rahasia");
ok(hits.length === 0, "searching a password value finds nothing");
hits = await q("password");
ok(!hits.some((h) => h.title.startsWith("Passion")), "a synonym must start a word: password does not find Passion");
hits = await q("whatsapp");
ok(!hits.some((h) => h.title.startsWith("Jawa")), "whatsapp → synonym wa does not match inside Jawa");
hits = await q("cv");
ok(hits.every((h) => !h.close), "short words never use spelling tolerance");
await sql.end(); process.exit(process.exitCode || 0);
