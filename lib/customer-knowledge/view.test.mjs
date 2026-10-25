// Customer Knowledge: month labels map stored values; keywords and filters agree with the panels.
import assert from "node:assert/strict";
import test from "node:test";
import { distribution, filterPainPoints, labelsOf, monthCounts, monthLabel, topKeywords } from "./view.ts";

const rows = [
  { id: 1, komentar: "Susah cari loker MT yang cocok", platform: "TikTok", kategori: "Karier", bulan: "Okt", labels: ["loker"] },
  { id: 2, komentar: "CV ditolak terus, susah cari kerja", platform: "Instagram", kategori: "CV", bulan: "Okt", labels: '["cv","urgent"]' },
  { id: 3, komentar: "Psikotes MT bikin pusing", platform: "TikTok", kategori: "", bulan: "Mei", labels: "tes, mt" },
];

test("stored Indonesian months show as English, counts by month", () => {
  assert.equal(monthLabel("Okt"), "Oct"); assert.equal(monthLabel("Mei"), "May"); assert.equal(monthLabel("Des"), "Dec"); assert.equal(monthLabel("Jan"), "Jan");
  const c = monthCounts(rows); assert.equal(c[9], 2); assert.equal(c[4], 1);
});

test("labels parse from arrays, JSON text and comma lists", () => {
  assert.deepEqual(rows.map(labelsOf), [["loker"], ["cv", "urgent"], ["tes", "mt"]]);
});

test("keywords: per comment, phrases need two comments, stopwords dropped", () => {
  const k = Object.fromEntries(topKeywords(rows));
  assert.equal(k.susah, 2); assert.equal(k["susah cari"], 2); assert.equal(k.mt, 2);
  assert.equal(k.yang, undefined); assert.equal(k["cari loker"], undefined, "a phrase in one comment only is not a keyword");
});

test("category panel counts match the category filter (empty = Unknown)", () => {
  for (const [name, count] of distribution(rows, "kategori")) assert.equal(filterPainPoints(rows, { category: name }).length, count, name);
  assert.deepEqual(filterPainPoints(rows, { platform: "TikTok", month: "Okt" }).map((r) => r.id), [1]);
  assert.deepEqual(filterPainPoints(rows, { label: "urgent" }).map((r) => r.id), [2]);
});

test("repeated words skip filler words (atau, apakah, buat, dimana, kayak, gini…)", () => {
  const rows = ["Apakah psikotes BUMN atau tes online biasanya dimana kak?", "Buat psikotes kayak gini harus belajar apa", "Soal psikotes numerik kah yang susah?"].map((komentar) => ({ komentar }));
  const words = topKeywords(rows).map(([word]) => word);
  assert.ok(words.includes("psikotes") && words.includes("soal"));
  for (const filler of ["atau", "apakah", "biasanya", "buat", "dimana", "harus", "kah", "kayak", "gini", "apa"]) assert.ok(!words.includes(filler), filler);
});
