// Marketing helpers: date ranges, English action labels, Instagram follower series, ad decisions.
import assert from "node:assert/strict";
import test from "node:test";
import { actionLabel, decisionOf, followersSeries, inRange } from "./view.ts";

test("date ranges", () => {
  assert.equal(inRange("2026-10-16", "7", "2026-10-23"), true);
  assert.equal(inRange("2026-10-15", "7", "2026-10-23"), false);
  assert.equal(inRange("2020-01-01", "0", "2026-10-23"), true);
  assert.equal(inRange("2026-10-10", "custom", "2026-10-23", "2026-10-01", ""), true);
  assert.equal(inRange("2026-10-10", "custom", "2026-10-23", "", "2026-10-09"), false);
});

test("action labels shown in English, unknown values passed through", () => {
  assert.equal(actionLabel("Boost ke Meta Ads"), "Boost on Meta Ads");
  assert.equal(actionLabel("Something else"), "Something else");
  assert.equal(decisionOf({}), "Pending"); assert.equal(decisionOf({ ad_decision: "Boost" }), "Boost"); assert.equal(decisionOf({ ad_decision: "x" }), "Pending");
});

test("followers anchored on the verified baseline, derived both ways", () => {
  const snaps = [
    { week_start: "2026-09-07", followers_total: 900, follows_gained: 10 },
    { week_start: "2026-09-14", followers_total: 950, follows_gained: 20 },
    { week_start: "2026-09-21", followers_total: 990, follows_gained: 30 },
  ];
  const s = followersSeries(snaps, { followers_total: 500, baseline_date: "2026-09-14" });
  assert.deepEqual(s.map((r) => r.computedFollowers), [480, 500, 530], "before anchor subtracts the later week's gain");
  assert.deepEqual(followersSeries(snaps, null).map((r) => r.computedFollowers), [940, 960, 990], "no baseline: latest stored total anchors");
});
