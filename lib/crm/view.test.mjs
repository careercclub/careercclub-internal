// CRM: customers grouped by WhatsApp; funnel counts add up and match the stage filter.
import assert from "node:assert/strict";
import test from "node:test";
import { crmSummary, filterCustomers, FUNNEL, funnelStage, groupCustomers, rupiah, statusLabel } from "./view.ts";

const rows = [
  { id: "a1", name: "Siti", wa: "0812 111", email: "s@x.id", status: "Diblast", harga: 100000, tanggal: "2026-09-01" },
  { id: "a2", name: "Siti", wa: "+62812111", email: "s@x.id", status: "Sudah convert — Upsell", harga: 250000, tanggal: "2026-10-01" },
  { id: "b1", name: "Budi", wa: "812222", status: "Belum diblast", harga: 50000, talent_pool_match: { id: "t" } },
  { id: "c1", name: "Cici", email: "c@x.id", status: "Sedang di-upsell", riwayat: JSON.stringify([{ produk: "A", harga: 1000 }, { produk: "B", harga: 2000 }]), payment_status: "FAILED" },
];

test("one customer per WhatsApp number, newest row on top, history kept", () => {
  const c = groupCustomers(rows);
  assert.equal(c.length, 3);
  const siti = c.find((x) => x.name === "Siti");
  assert.deepEqual(siti.ids, ["a1", "a2"]);
  assert.equal(siti.status, "Sudah convert — Upsell", "status comes from the latest transaction");
  assert.equal(siti.spend, 350000);
  assert.equal(c.find((x) => x.name === "Cici").txCount, 2, "riwayat stored as a JSON string still counts");
});

test("funnel: every buyer in exactly one stage; stage filter agrees", () => {
  const c = groupCustomers(rows); const s = crmSummary(c);
  assert.equal(Object.values(s.funnel).reduce((a, b) => a + b, 0), s.buyers);
  for (const [id] of FUNNEL) assert.equal(filterCustomers(c, { stage: id }).length, s.funnel[id], id);
  assert.equal(funnelStage("Belum diblast"), "new", "\"Belum diblast\" is not counted as blasted");
  assert.equal(funnelStage(""), "new");
  assert.equal(s.notInPool, 2);
  assert.equal(s.repeat, 2);
});

test("filters and labels", () => {
  const c = groupCustomers(rows);
  assert.deepEqual(filterCustomers(c, { payment: "FAILED" }).map((x) => x.name), ["Cici"]);
  assert.deepEqual(filterCustomers(c, { pool: "yes" }).map((x) => x.name), ["Budi"]);
  assert.deepEqual(filterCustomers(c, { query: "812222" }).map((x) => x.name), ["Budi"]);
  assert.equal(statusLabel("Sedang di-cross sell"), "Cross-selling");
  assert.equal(statusLabel(""), "Not blasted");
  assert.equal(rupiah(350000), "Rp350k");
  assert.equal(rupiah(1_250_000), "Rp1.3M");
});
