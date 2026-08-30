import assert from "node:assert/strict";
import test from "node:test";
import { buildPaletteIndex, scorePaletteEntry, searchPalette } from "./palette-index.ts";

const SECTIONS = [
  {
    label: "Marketing",
    pages: [
      { slug: "content-planning", title: "Content Planning", path: "/content-planning", icon: "ti-calendar-event", description: "Calendar planning for IG and TikTok." },
      { slug: "content-library", title: "Content Library", path: "/content-library", icon: "ti-photo", description: "Reusable creative references." },
    ],
  },
  {
    label: "Operations",
    pages: [
      { slug: "tickets", title: "Tickets", path: "/tickets", icon: "ti-ticket", description: "Internal request board." },
    ],
  },
];

const RECORDS = [
  { path: "/content-planning/kol", title: "KOL directory", eyebrow: "Content planning", description: "Track creator profiles." },
  { path: "/tickets/divisions", title: "Ticket divisions", eyebrow: "Tickets", description: "Manage divisions." },
  // Collides with a nav page — the nav entry should win.
  { path: "/content-library", title: "Content library", eyebrow: "Content", description: "Catalog copy of the same route." },
];

const index = () => buildPaletteIndex(SECTIONS, RECORDS);
const paths = (entries) => entries.map((entry) => entry.path);

test("indexes both top-level pages and nested catalog routes", () => {
  assert.deepEqual(
    paths(index()).sort(),
    ["/content-library", "/content-planning", "/content-planning/kol", "/tickets", "/tickets/divisions"],
  );
});

test("a nav page wins over a catalog entry for the same path", () => {
  const entry = index().find((item) => item.path === "/content-library");
  assert.equal(entry.title, "Content Library");
  assert.equal(entry.icon, "ti-photo");
  assert.equal(entry.section, "Marketing");
});

test("every route appears exactly once", () => {
  const all = paths(index());
  assert.equal(new Set(all).size, all.length);
});

// Settings can hide a module. The palette must not become a back door into it.
test("hiding a module hides the module and its nested routes", () => {
  const visible = paths(buildPaletteIndex(SECTIONS, RECORDS, ["content-planning"]));
  assert.ok(!visible.includes("/content-planning"), "hidden module still listed");
  assert.ok(!visible.includes("/content-planning/kol"), "nested route of a hidden module still listed");
  assert.ok(visible.includes("/tickets"), "unrelated module was hidden");
});

test("hiding one module does not hide another with a similar path prefix", () => {
  const visible = paths(buildPaletteIndex(SECTIONS, RECORDS, ["content-library"]));
  assert.ok(!visible.includes("/content-library"));
  assert.ok(visible.includes("/content-planning"), "/content-planning was hidden by the /content-library prefix");
});

test("an empty query returns everything", () => {
  assert.equal(searchPalette(index(), "").length, index().length);
  assert.equal(searchPalette(index(), "   ").length, index().length);
});

test("ranks a title match above a description-only match", () => {
  const results = searchPalette(index(), "ticket");
  assert.equal(results[0].path, "/tickets");
});

test("matches on path and on section, not just title", () => {
  assert.ok(paths(searchPalette(index(), "kol")).includes("/content-planning/kol"));
  assert.ok(paths(searchPalette(index(), "divisions")).includes("/tickets/divisions"));
  assert.ok(paths(searchPalette(index(), "marketing")).includes("/content-planning"));
});

test("search is case-insensitive", () => {
  assert.deepEqual(paths(searchPalette(index(), "TICKETS")), paths(searchPalette(index(), "tickets")));
});

test("returns nothing for a query that matches no route", () => {
  assert.deepEqual(searchPalette(index(), "zzzznotathing"), []);
});

test("scores an exact title above a prefix above a substring", () => {
  const entry = { path: "/tickets", title: "Tickets", section: "Operations", icon: "ti-ticket", hint: "Internal request board." };
  assert.ok(scorePaletteEntry(entry, "tickets") < scorePaletteEntry(entry, "ticket"));
  assert.ok(scorePaletteEntry(entry, "ticket") < scorePaletteEntry(entry, "operations"));
  assert.equal(scorePaletteEntry(entry, "nope"), -1);
});
