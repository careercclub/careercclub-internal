// Putaran 58: the same number comes from one function everywhere (audit of numbers on screens).
import assert from "node:assert/strict";
import test from "node:test";
import { priceBoard, threatOf } from "../competitor/view.ts";
import { crmSummary, funnelStage, groupCustomers } from "../crm/view.ts";
import { averageRating, filterPainPoints, distribution } from "../customer-knowledge/view.ts";
import { calendarMonth, openIn } from "../mt-prospects/view.ts";
import { isCalendarTicket } from "../tickets/calendar.ts";
import { timeOf } from "../text/date.ts";

test("competitor threat and price use the newest row even when dates arrive as Date objects", () => {
  const profile = { id: "c1", threat_level: "low" };
  const snapshots = [
    { competitor_id: "c1", snapshot_date: new Date("2026-09-01T00:00:00Z"), threat_level: "low" }, // Tue
    { competitor_id: "c1", snapshot_date: new Date("2026-10-01T00:00:00Z"), threat_level: "high" }, // Thu
  ];
  assert.equal(threatOf(profile, snapshots), "high");
  const board = priceBoard([{ id: "p1", kategori: "Kelas" }], [
    { product_id: "p1", recorded_at: new Date("2026-08-04T00:00:00Z"), price_min: 100 }, // Tue
    { product_id: "p1", recorded_at: new Date("2026-10-08T00:00:00Z"), price_min: 250 }, // Thu
  ]);
  assert.equal(board[0].items[0].price, 250);
  assert.ok(timeOf("2026-10-01") > timeOf(new Date("2026-09-30T00:00:00Z")));
});

test("CRM: one buyer with three rows is one converted buyer everywhere", () => {
  const rows = [1, 2, 3].map((i) => ({ id: `b${i}`, wa: "08123", status: "Sudah convert — Upsell", tanggal: `2026-0${i}-01` }));
  const summary = crmSummary(groupCustomers(rows));
  assert.equal(summary.buyers, 1);
  assert.equal(summary.funnel.converted, 1);
  assert.equal(funnelStage(""), "new", "an empty status is 'not blasted' in the funnel and in the blast segment");
});

test("Free Class: one average for header and tab", () => {
  const rows = [{ a: 5, b: 4 }, { a: 3 }];
  assert.equal(averageRating(rows, ["a", "b"]).toFixed(4), (12 / 3).toFixed(4));
});

test("Customer Knowledge: clicking Unknown finds the rows counted as Unknown", () => {
  const rows = [{ platform: "" , komentar: "x" }, { platform: "TikTok", komentar: "y" }];
  const unknown = distribution(rows, "platform").find(([name]) => name === "Unknown")[1];
  assert.equal(filterPainPoints(rows, { platform: "Unknown" }).length, unknown);
});

test("Job Vacancy MT: 'Open in October' = Calendar 'Scheduled' for October", () => {
  const rows = [
    { id: "1", brand: "A", legal_name: "", status: "active", openings: { "2026": { months: [10], label: "", dates: "" } } },
    { id: "2", brand: "B", legal_name: "", status: "excluded", openings: { "2026": { months: [10], label: "", dates: "" } } },
    { id: "3", brand: "C", legal_name: "", status: "older", openings: { "2026": { months: [10], label: "", dates: "" } } },
  ];
  assert.equal(openIn(rows, 2026, 10).length, calendarMonth(rows, 2026, 10).scheduled.length);
});

test("calendar leaves out Cancelled tickets, like every other count", () => {
  assert.equal(isCalendarTicket({ status: "Cancelled", due_date: "2026-10-01" }), false);
  assert.equal(isCalendarTicket({ status: "Todo", due_date: "2026-10-01" }), true);
});
