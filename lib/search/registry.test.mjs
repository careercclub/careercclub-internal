import assert from "node:assert/strict";
import test from "node:test";
import { recordDefinitions } from "../records/catalog.ts";
import { extraSearchDefinitions } from "./extra-definitions.ts";
import { buildSearchSpecs, highlightParts, rankSearchHits, rowMatches, searchTerms, toSearchHit } from "./registry.ts";

const specs = buildSearchSpecs({ ...recordDefinitions, ...extraSearchDefinitions });
const spec = (key) => specs.find((item) => item.key === key);

test("password, ID, dan kunci file tidak pernah bisa dicari", () => {
  for (const item of specs) {
    for (const field of item.fields) {
      assert.doesNotMatch(field.name, /password|secret|token|(^|_)id$|_ids$|storage_path|thumbnail_key/, `${item.key}.${field.name}`);
    }
  }
  assert.ok(!spec("resources").fields.some((field) => field.name === "password"));
  assert.ok(!spec("app_settings"), "app_settings bisa berisi rahasia, harus dikecualikan");
});

test("modul yang lo sebut ikut tercakup: Resources, Design assets, Content library", () => {
  assert.deepEqual(spec("resources").fields.map((field) => field.name), ["tipe", "kategori", "nama", "url", "email", "username", "notes"]);
  assert.equal(spec("resources").titleFields[0], "nama");
  assert.equal(spec("design_assets").titleFields[0], "nama");
  assert.deepEqual(spec("content_library").titleFields, ["platform", "jenis"]);
  assert.ok(spec("design_assets").fields.every((field) => field.name !== "storage_path" && field.name !== "storage_paths"));
});

test("Job Vacancy MT ikut dicari: perusahaan lewat brand/nama PT/program, kontak HR lewat nama/jabatan", () => {
  const row = { id: "p1", brand: "Garudafood", legal_name: "PT Garudafood Putra Putri Jaya Tbk", program: "Management Trainee\nRole/varian: Sales", industry: "FMCG" };
  assert.ok(rowMatches(row, spec("mt_prospects"), ["putra", "putri"]));
  assert.ok(rowMatches(row, spec("mt_prospects"), ["trainee"]));
  const hit = toSearchHit(row, spec("mt_prospects"), ["garudafood"]);
  assert.equal(hit.title, "Garudafood · PT Garudafood Putra Putri Jaya Tbk");
  assert.equal(hit.href, "/job-vacancy-mt?focus=p1");
  const contact = toSearchHit({ id: "c1", name: "Rina Contoh", title: "Talent Acquisition" }, spec("mt_prospect_contacts"), ["talent"]);
  assert.equal(contact.title, "Rina Contoh");
  assert.equal(contact.href, "/job-vacancy-mt?focus=c1");
});

test("tiap hasil punya halaman tujuan yang ada di katalog", () => {
  for (const item of specs) assert.match(item.path, /^\/[a-z0-9/-]+$/, item.key);
});

test("kata kunci dipecah per kata, semua kata wajib cocok", () => {
  assert.deepEqual(searchTerms("  Email   CCC "), ["email", "ccc"]);
  const row = { id: "r1", tipe: "credential", kategori: "Account", nama: "Email CCC", email: "internal.careercclub@example.com", password: "rahasia" };
  assert.ok(rowMatches(row, spec("resources"), ["email", "ccc"]));
  assert.ok(rowMatches(row, spec("resources"), ["careercclub"]), "cocok lewat kolom email");
  assert.ok(!rowMatches(row, spec("resources"), ["email", "canva"]));
  assert.ok(!rowMatches(row, spec("resources"), ["rahasia"]), "isi password tidak boleh membuat data cocok");
});

test("hasil: judul dari nama, link membuka data di modulnya, password tidak bocor", () => {
  const row = { id: "abc-1", tipe: "credential", kategori: "Account", nama: "Canva", email: "career.cclub.design@example.com", notes: "Pilih login via code", password: "rahasia" };
  const hit = toSearchHit(row, spec("resources"), ["career.cclub"]);
  assert.equal(hit.title, "Canva");
  assert.equal(hit.href, "/resources?focus=abc-1");
  assert.equal(hit.matchLabel, "Email");
  assert.equal(hit.snippet, "career.cclub.design@example.com");
  assert.ok(!JSON.stringify(hit).includes("rahasia"));
});

test("judul sudah cocok semua → konteks yang ditampilkan email, bukan catatan", () => {
  const row = { id: "r1", tipe: "credential", kategori: "Account", nama: "Email CCC", email: "internal.careercclub@example.com", notes: "Akses ke email internal" };
  const hit = toSearchHit(row, spec("resources"), ["email", "ccc"]);
  assert.equal(hit.matchLabel, "Email");
  assert.equal(hit.snippet, "internal.careercclub@example.com");
});

test("label JSON (array) ikut dicari sebagai teks biasa", () => {
  const row = { id: "c1", platform: "Instagram", jenis: "Carousel", link: "https://ig/p/1", labels: ["Entertain Content"], copywriting: "Kalau karakter The Odyssey" };
  assert.ok(rowMatches(row, spec("content_library"), ["entertain"]));
  const hit = toSearchHit(row, spec("content_library"), ["odyssey"]);
  assert.equal(hit.title, "Instagram · Carousel");
  assert.equal(hit.matchLabel, "Copywriting");
});

test("snippet panjang dipotong di sekitar kata yang cocok", () => {
  const long = `${"a ".repeat(80)}KATAKUNCI ${"b ".repeat(80)}`;
  const hit = toSearchHit({ id: "x", nama: "Judul", notes: long }, spec("resources"), ["katakunci"]);
  assert.ok(hit.snippet.includes("KATAKUNCI"));
  assert.ok(hit.snippet.length <= 72);
});

test("ranking: judul persis di atas, kecocokan di kolom lain di bawah", () => {
  const make = (title) => ({ key: "k", id: title, title, module: "M", path: "/m", href: "/m", matchLabel: "", snippet: "" });
  const ranked = rankSearchHits([make("Catatan tentang canva"), make("Canva Pro"), make("Canva"), make("Lain")], ["canva"]);
  assert.deepEqual(ranked.map((hit) => hit.title), ["Canva", "Canva Pro", "Catatan tentang canva", "Lain"]);
});

test("kata yang cocok ditandai untuk ditebalkan, huruf besar-kecil asli tetap", () => {
  assert.deepEqual(highlightParts("Email CCC", ["email", "ccc"]), [{ text: "Email", match: true }, { text: " ", match: false }, { text: "CCC", match: true }]);
  assert.deepEqual(highlightParts("Canva", ["zzz"]), [{ text: "Canva", match: false }]);
  assert.deepEqual(highlightParts("aaa", ["a"]), [{ text: "aaa", match: true }]);
  assert.deepEqual(highlightParts("", ["a"]), []);
});
