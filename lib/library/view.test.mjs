import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPeople, filterResources, groupResources, hostOf, hrefOf, initials, listOf, moveResource, peopleSummary, services, sortResources } from "./view.ts";

const res = [
  { id: "a", kategori: "Tools", nama: "Canva", url: "https://www.canva.com/x", tipe: "credential", urutan: 1, username: "ccc" },
  { id: "b", kategori: "Tools", nama: "Figma", url: "figma.com", tipe: "link", urutan: 0 },
  { id: "c", kategori: "", nama: "Drive", url: "https://drive.google.com", tipe: "link" },
];
test("resources sort, group and filter", () => {
  const sorted = sortResources(res);
  assert.deepEqual(sorted.map((r) => r.id), ["c", "b", "a"]);
  assert.deepEqual(groupResources(sorted).map(([k, v]) => [k, v.length]), [["Other", 1], ["Tools", 2]]);
  assert.deepEqual(filterResources(res, { kind: "credential" }).map((r) => r.id), ["a"]);
  assert.deepEqual(filterResources(res, { kind: "link", category: "Other" }).map((r) => r.id), ["c"]);
  assert.deepEqual(filterResources(res, { query: "ccc" }).map((r) => r.id), ["a"]);
});
test("move stays inside its category", () => {
  const sorted = sortResources(res);
  assert.deepEqual(moveResource(sorted, "a", -1).map((r) => r.id), ["c", "a", "b"]);
  assert.equal(moveResource(sorted, "b", -1), null);
  assert.equal(moveResource(sorted, "c", 1), null);
});
test("hosts and links", () => {
  assert.equal(hostOf("https://www.canva.com/x"), "canva.com");
  assert.equal(hostOf("figma.com/file"), "figma.com");
  assert.equal(hrefOf("figma.com"), "https://figma.com");
  assert.equal(hrefOf(""), "");
});
test("people", () => {
  const rows = [{ tipe: "collaborator", nama: "Ani Budi", privy: true, status: "Active" }, { tipe: "collaborator", nama: "Cici" }, { tipe: "advisor", nama: "Dodi", status: "Pending" }];
  assert.deepEqual(peopleSummary(rows), { collaborators: 2, advisors: 1, privyMissing: 1 });
  assert.equal(filterPeople(rows, "collaborator", "", "privy-missing")[0].nama, "Cici");
  assert.equal(filterPeople(rows, "advisor", "dod").length, 1);
  assert.equal(initials("Ani Budi"), "AB");
  assert.equal(initials(""), "?");
  assert.deepEqual(services('[{"label":"Review CV","rate":"500k"},"Mentoring"]'), [{ label: "Review CV", rate: "500k" }, { label: "Mentoring", rate: "" }]);
  assert.deepEqual(listOf("a, b"), ["a", "b"]);
});
