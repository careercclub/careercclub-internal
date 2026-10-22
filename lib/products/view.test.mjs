// Products: filters, catalog numbers, bundle math and the bundle knowledge base.
import assert from "node:assert/strict";
import test from "node:test";
import { bundleMath, catalogSummary, filterProducts, knowledgeFor } from "./view.ts";

const products = [
  { id: "a", nama: "Kelas CV", kategori: "Elearning", harga: 100000, status: "Live" },
  { id: "b", nama: "Psikotes Pro", kategori: "Psikotes", harga: 150000, status: "Draft", type: "satuan" },
  { id: "c", nama: "Paket MT", kategori: "Bundling Package", harga: 200000, status: "Live", type: "bundling" },
  { id: "d", nama: "Arsip lama", harga: 50000, status: "Archived" },
];
const links = [{ bundle_id: "c", item_id: "a" }, { bundle_id: "c", item_id: "b" }];

test("filters and sort", () => {
  assert.deepEqual(filterProducts(products, { type: "bundling" }).map((p) => p.id), ["c"]);
  assert.deepEqual(filterProducts(products, { type: "satuan", sort: "high" }).map((p) => p.id), ["b", "a", "d"], "no type = single product");
  assert.deepEqual(filterProducts(products, { status: "Draft" }).map((p) => p.id), ["b"]);
  assert.deepEqual(filterProducts(products, { query: "psiko" }).map((p) => p.id), ["b"]);
});

test("catalog numbers add up", () => {
  const s = catalogSummary(products);
  assert.deepEqual(s, { total: 4, live: 2, bundles: 1, single: 3, value: 500000 });
});

test("bundle math and merged knowledge", () => {
  const m = bundleMath(products[2], products, links);
  assert.deepEqual(m.memberIds, ["a", "b"]);
  assert.equal(m.subtotal, 250000);
  assert.equal(m.saving, 20);
  assert.equal(bundleMath({ id: "x", harga: 200000 }, products, [{ bundle_id: "x", item_id: "a" }]).saving, 0, "a bundle priced above its parts shows no saving");
  const pains = [{ id: 1, product_id: "a" }, { id: 2, product_id: "c" }, { id: 3, product_id: "d" }];
  assert.deepEqual(knowledgeFor(pains, "c", m.memberIds).map((r) => r.id), [1, 2]);
});
