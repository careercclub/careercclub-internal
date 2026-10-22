// Partnership: board columns hold every partner once; activity per partner; outreach by day.
import assert from "node:assert/strict";
import test from "node:test";
import { outreachByDay, partnerActivity, partnerSummary, pipelineColumns, PARTNER_STATUSES } from "./view.ts";

const partners = [
  { id: 1, name: "A", status: "Approached", tier: "Strategic" },
  { id: 2, name: "B", status: "Negotiation" },
  { id: 3, name: "C", status: "Closed Deal", tier: "Strategic" },
  { id: 4, name: "D", status: "" },
  { id: 5, name: "E", status: "Old status" },
];

test("board: fixed column order, every partner exactly once", () => {
  const cols = pipelineColumns(partners);
  assert.deepEqual(cols.map((c) => c.status), PARTNER_STATUSES);
  assert.equal(cols.flatMap((c) => c.rows).length, partners.length);
  assert.deepEqual(cols[0].rows.map((r) => r.name), ["A", "D", "E"], "empty or unknown status goes to the first column");
});

test("summary numbers", () => {
  assert.deepEqual(partnerSummary(partners), { total: 5, open: 4, negotiation: 1, closed: 1, strategic: 2 });
});

test("activity and outreach by day", () => {
  const deals = [{ partner_id: 1 }, { partner_id: 1 }, { partner_id: 2 }, { partner_id: null }];
  const logs = [{ id: "x", partner_id: 1, tanggal: "2026-10-01" }, { id: "y", partner_id: 1, tanggal: new Date(2026, 9, 5) }, { id: "z", partner_id: 3 }];
  const a = partnerActivity(deals, logs, "partner_id");
  assert.deepEqual(a.get("1"), { deals: 2, lastContact: "2026-10-05" });
  assert.deepEqual(a.get("3"), { deals: 0, lastContact: "" });
  assert.deepEqual(outreachByDay(logs).map((g) => g.date), ["2026-10-05", "2026-10-01", ""]);
});
