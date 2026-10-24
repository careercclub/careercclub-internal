import assert from "node:assert/strict";
import test from "node:test";
import { aiSearchSystemPrompt, keywordScore, looksLikeQuestion, parseAiPlan, planCacheKey } from "./ai-plan.ts";

const MODULES = [{ key: "resources", module: "Resources", fields: [{ label: "Name" }, { label: "Email" }] }, { key: "tickets", module: "Tickets", fields: [{ label: "Title" }] }];

test("the AI is told module and field names only", () => {
  const prompt = aiSearchSystemPrompt(MODULES, "2026-10-25");
  assert.match(prompt, /resources: Resources \(Name, Email\)/);
  assert.match(prompt, /Today is 2026-10-25/);
  assert.match(prompt, /never see the data/i);
});

test("the plan keeps known modules and short keywords only", () => {
  const plan = parseAiPlan({ keywords: ["Canva", "  figma ", "x", "canva", 42, "a".repeat(80)], modules: ["resources", "DROP TABLE", "tickets", "resources"] }, ["resources", "tickets"]);
  assert.deepEqual(plan.modules, ["resources", "tickets"]);
  assert.deepEqual(plan.keywords.slice(0, 2), ["canva", "figma"]);
  assert.ok(plan.keywords.every((word) => word.length >= 2 && word.length <= 40));
  assert.deepEqual(parseAiPlan("nonsense", ["resources"]), { keywords: [], modules: [] });
});

test("sentence-like queries offer AI; repeated questions share a cache key", () => {
  assert.ok(looksLikeQuestion("akun buat desain"));
  assert.ok(!looksLikeQuestion("canva"));
  assert.equal(planCacheKey("  Akun  buat Desain "), "akun buat desain");
  assert.equal(keywordScore("Canva · design login", ["canva", "figma", "login"]), 2);
});
