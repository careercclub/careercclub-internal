// Traceability for navigation: every page is reachable from the menu, every retired
// address forwards to the one place its data is managed, and nothing links to a retired page.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { recordDefinitions } from "./catalog.ts";
import { RETIRED_PAGES, SETTINGS_SECTIONS, isChildActive, moduleChildren, withFocus } from "./links.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dashboard = join(root, "app", "(dashboard)");
const read = (path) => readFileSync(path, "utf8");

function routes(dir = dashboard, prefix = "") {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) return name === "page.tsx" ? [prefix || "/"] : [];
    return name.startsWith("_") ? [] : routes(full, `${prefix}/${name}`);
  });
}

const navPages = [...read(join(dashboard, "_data", "navigation.ts")).matchAll(/path:\s*"([^"]+)"/g), ...read(join(dashboard, "_data", "navigation-all.ts")).matchAll(/path:\s*"([^"]+)"/g)].map((match) => match[1]);
const children = moduleChildren(true);
const childPaths = Object.values(children).flat().map((link) => link.href.split("?")[0]);
const allRoutes = routes();
const pathOf = (href) => href.split("?")[0];
const tabOf = (href) => new URLSearchParams(href.split("?")[1] || "").get("tab");
const PAGE_TABS = { "/settings": SETTINGS_SECTIONS.map((section) => section.id), "/b2b-partnership": ["deals", "outreach"], "/org-partnership": ["deals", "outreach"] };

test("setiap halaman bisa dicapai dari menu (atau diarahkan ke tempat barunya)", () => {
  const orphans = allRoutes.filter((route) => route !== "/" && !navPages.includes(route) && !childPaths.includes(route) && !RETIRED_PAGES[route]);
  assert.deepEqual(orphans, []);
});

test("alamat lama diarahkan ke halaman & tab yang benar-benar ada", () => {
  for (const [from, to] of Object.entries(RETIRED_PAGES)) {
    assert.ok(allRoutes.includes(from), `${from} bukan route`);
    assert.ok(allRoutes.includes(pathOf(to)), `${from} → ${to}: halaman tujuan tidak ada`);
    const tab = tabOf(to);
    if (tab) assert.ok(PAGE_TABS[pathOf(to)]?.includes(tab), `${from} → ${to}: tab "${tab}" tidak dikenal`);
    const source = read(join(dashboard, ...from.split("/").filter(Boolean), "page.tsx"));
    assert.match(source, new RegExp(`RETIRED_PAGES\\["${from.replaceAll("/", "\\/")}"\\]`), `${from} tidak memakai redirect`);
    assert.match(source, /withFocus\(/, `${from}: ?focus dari search harus ikut diteruskan`);
  }
});

test("menu dan katalog tidak menunjuk alamat lama", () => {
  for (const link of Object.values(children).flat()) assert.ok(!RETIRED_PAGES[pathOf(link.href)], link.href);
  for (const [key, definition] of Object.entries(recordDefinitions)) assert.ok(!RETIRED_PAGES[definition.path], `${key} → ${definition.path}`);
});

test("tidak ada link di kode yang menunjuk alamat lama", () => {
  const files = (dir) => readdirSync(join(root, dir)).flatMap((name) => { const path = join(dir, name); return statSync(join(root, path)).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : []; });
  const offenders = [];
  for (const file of [...files("app"), ...files("lib")]) {
    if (file.endsWith("links.ts")) continue;
    const source = read(join(root, file));
    for (const old of Object.keys(RETIRED_PAGES)) if (source.includes(`"${old}"`) && !source.includes(`RETIRED_PAGES["${old}"]`)) offenders.push(`${file} → ${old}`);
  }
  assert.deepEqual(offenders, []);
});

test("satu tempat per data: tabel master hanya dikelola di Settings", () => {
  const settings = read(join(root, "app", "_components", "settings-workspace.tsx"));
  for (const key of ["tkt_divisi", "tkt_people", "tkt_types", "product_klasifikasi", "master_produk", "carousel_cta_options", "event_link_templates"]) {
    assert.equal(recordDefinitions[key].path, "/settings", key);
    assert.match(settings, new RegExp(`definitionKey="${key}"`), `${key} tidak tampil di Settings`);
  }
  for (const key of ["pain_point_platforms", "pain_point_categories"]) assert.equal(recordDefinitions[key].path, "/settings", key);
  for (const section of SETTINGS_SECTIONS) assert.match(settings, new RegExp(`tab === "${section.id}"`), `bagian Settings "${section.id}" tidak dirender`);
});

test("bagian Users & roles hanya untuk admin", () => {
  assert.ok(moduleChildren(true)["/settings"].some((link) => link.href.includes("tab=users")));
  assert.ok(!moduleChildren(false)["/settings"].some((link) => link.href.includes("tab=users")));
});

test("?focus dari search ikut diteruskan saat diarahkan", () => {
  assert.equal(withFocus("/settings?tab=tickets&section=people", "abc"), "/settings?tab=tickets&section=people&focus=abc");
  assert.equal(withFocus("/b2b-partnership", "a b"), "/b2b-partnership?focus=a%20b");
  assert.equal(withFocus("/settings?tab=menu", undefined), "/settings?tab=menu");
  assert.equal(withFocus("/x", ["first", "second"]), "/x?focus=first");
});

test("tanda halaman aktif di menu membedakan ?tab", () => {
  assert.ok(isChildActive("/b2b-partnership?tab=deals", "/b2b-partnership", "tab=deals"));
  assert.ok(!isChildActive("/b2b-partnership?tab=deals", "/b2b-partnership", ""));
  assert.ok(isChildActive("/b2b-partnership", "/b2b-partnership", ""));
  assert.ok(isChildActive("/products/features", "/products/features", ""));
  assert.ok(!isChildActive("/products", "/products/features", ""));
});
