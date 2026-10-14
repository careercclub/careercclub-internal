// Traceability for the ticket role rule: every place that shows tickets to a person
// (pages, nav badge, global search) must go through the shared visibility rule.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path) => readFileSync(join(root, path), "utf8");

function files(dir) {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test("tidak ada halaman yang mengambil semua tiket tanpa aturan role", () => {
  const offenders = files("app").filter((path) => /\bgetTicketWorkspace\(|\blistTickets\(/.test(read(path))).map((path) => relative(root, join(root, path)));
  assert.deepEqual(offenders, [], "pakai getVisibleTicketWorkspace(viewer)");
});

test("Tickets, Dashboard, dan Program memakai getVisibleTicketWorkspace", () => {
  for (const page of ["app/(dashboard)/tickets/page.tsx", "app/(dashboard)/dashboard/page.tsx", "app/(dashboard)/program/page.tsx"]) {
    assert.match(read(page), /getVisibleTicketWorkspace\(/, page);
  }
});

test("badge menu Tickets menghitung tiket yang boleh dilihat", () => {
  const layout = read("app/(dashboard)/layout.tsx");
  assert.match(layout, /countVisibleTickets\(/);
  assert.doesNotMatch(layout, /tickets: counts\.tickets/);
});

test("search menerapkan aturan yang sama untuk tabel tickets", () => {
  const query = read("lib/search/query.ts");
  assert.match(query, /tickets:\s*\{[\s\S]*ticketVisibility\(/);
});
