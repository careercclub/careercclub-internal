import assert from "node:assert/strict";
import test from "node:test";
import { closeWordIn, containsWord, editDistance, expandTerm, groupMatches, typoBudget } from "./synonyms.ts";

test("one word finds its synonyms in both languages", () => {
  assert.ok(expandTerm("password").includes("credential"), "password → Logins (type credential)");
  assert.ok(expandTerm("tiket").includes("ticket"));
  assert.ok(expandTerm("loker").includes("vacancy"));
  assert.equal(expandTerm("password")[0], "password", "the typed word comes first");
  assert.deepEqual(expandTerm("canva"), ["canva"], "words without a group stay as typed");
});

test("typos: one mistake for 4-7 letters, two from 8, none for short words", () => {
  assert.equal(editDistance("pasword", "password"), 1);
  assert.equal(editDistance("passowrd", "password"), 1, "swapped neighbours count once");
  assert.equal(typoBudget("cv"), 0);
  assert.equal(typoBudget("canva"), 1);
  assert.equal(typoBudget("password"), 2);
  assert.ok(closeWordIn("Canva design account", "canvaa"));
  assert.ok(closeWordIn("Booklet CCA", "boklet"));
  assert.ok(!closeWordIn("CSV export", "cv"), "short words are never fuzzy");
  assert.ok(!closeWordIn("Meta Business", "canva"));
});

test("typed words match anywhere, synonyms only at a word start", () => {
  assert.ok(containsWord("internal.careercclub@gmail.com", "career", true));
  assert.ok(containsWord("wa 0812", "wa", false));
  assert.ok(!containsWord("jawa barat", "wa", false));
  assert.ok(!groupMatches("passion points", expandTerm("password")));
  assert.ok(groupMatches("type: credential", expandTerm("password")));
});
