import assert from "node:assert/strict";
import test from "node:test";
import { monday, planPosts, planWeeks, readPost, summarise } from "./agent.ts";

const EXISTING = [
  { id: "e1", post_id: "18034567890123401", judul: "Judul ketikan tim", url: "https://www.instagram.com/p/AAA/", format: "Carousel", tanggal: "2026-10-20", description: "Caption lama", account_id: null, account_username: "careercclub", followers: 15000, views: 1000, reach: 800, likes: 50, comments: 3, saves: 4, shares: 2, follows: null, profile_visits: null, link_taps: null, engaged: null, nf_pct: null, from_home: null, from_profile: null, from_other: null, duration: null, watchtime: null, wtr: 42, replays: null, dropoff: null, taps_forward: null, taps_back: null, exits: null, replies: null, stickers_interact: null },
];

test("a new post goes in with its numbers and a title from the caption", () => {
  const [item] = planPosts([{ post_id: "18099999999999999", url: "https://www.instagram.com/reel/BBB/", posted_at: "2026-10-22T10:00:00+0000", media_type: "VIDEO", caption: "Tips lolos MT\nBagian 1", reach: 5400, views: "12,000", saves: 41 }], EXISTING);
  assert.equal(item.action, "add");
  assert.equal(item.set.format, "Reel");
  assert.equal(item.set.tanggal, "2026-10-22");
  assert.equal(item.set.judul, "Tips lolos MT Bagian 1");
  assert.equal(item.set.views, 12000);
  assert.equal(item.set.reach, 5400);
});

test("an existing post: newest numbers win, the typed title stays, unsent fields stay", () => {
  const [item] = planPosts([{ post_id: "18034567890123401", reach: 950, views: 1000, likes: 61, caption: "Caption baru", title: "Judul dari Claude", followers_at_posting: 99 }], EXISTING);
  assert.equal(item.action, "update");
  assert.deepEqual(Object.keys(item.set).sort(), ["description", "likes", "reach"]);
  assert.deepEqual(item.changes.find((c) => c.field === "reach"), { field: "reach", from: 800, to: 950 });
  assert.equal(item.title, "Judul ketikan tim");
  assert.ok(!("wtr" in item.set) && !("judul" in item.set) && !("followers" in item.set));
});

test("nothing new → unchanged", () => {
  const [item] = planPosts([{ post_id: "18034567890123401", reach: 800, format: "carousel_album", posted_at: "2026-10-20" }], EXISTING);
  assert.equal(item.action, "unchanged");
});

test("invalid posts are refused with a reason", () => {
  const items = planPosts([{ post_id: 18034567890123401 }, { reach: 5 }, { post_id: "1", reach: -3 }, { post_id: "2", posted_at: "20/10/2026" }, { post_id: "3", url: "instagram.com/p/x" }, { post_id: "4" }, { post_id: "4" }], EXISTING);
  assert.deepEqual(items.map((i) => i.action), ["invalid", "invalid", "invalid", "invalid", "invalid", "add", "invalid"]);
  assert.match(items[0].errors[0], /as text/);
  assert.match(items[6].errors[0], /listed twice/);
});

test("readPost keeps only what was given", () => {
  const { values } = readPost({ post_id: "9", likes: 0 });
  assert.deepEqual(values, { judul: "Post 9", likes: 0 });
});

test("weeks: any day maps to its Monday; numbers replace, notes untouched", () => {
  assert.equal(monday("2026-10-25"), "2026-10-19");
  const items = planWeeks([{ week_start: "2026-10-22", followers_total: 15210, reach: 9000 }, { week_start: "2026-10-26", views: 100 }, { week_start: "2026-10-19", reach: 1 }, { week_start: "x" }], [{ id: "w1", week_start: "2026-10-19", followers_total: 15100, follows_gained: 0, reach: 9000, views: 0, interactions: 0, link_clicks: 0, profile_visits: 0 }]);
  assert.equal(items[0].action, "update");
  assert.deepEqual(items[0].set, { followers_total: 15210 });
  assert.equal(items[1].action, "add");
  assert.equal(items[2].action, "invalid");
  assert.equal(items[3].action, "invalid");
  const s = summarise(planPosts([], EXISTING), items);
  assert.equal(s.weeksUpdated + s.weeksAdded + s.weeksInvalid, 4);
});
