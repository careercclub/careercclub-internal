import assert from "node:assert/strict";
import test from "node:test";
import { alsoDeletesText, DELETE_RULES, stillUsedText } from "./delete-rules.ts";
import { optionLabel, withCurrent } from "../forms/options.ts";
import { invitablePeople, personLabel, REMOVED_PERSON } from "../tickets/people.ts";

test("confirm text says what goes with it", () => {
  assert.equal(alsoDeletesText([{ one: "deal", many: "deals", n: 3 }, { one: "outreach log", many: "outreach logs", n: 1 }]), "Also deletes 3 deals and 1 outreach log.");
  assert.equal(alsoDeletesText([{ one: "feature", many: "features", n: 0 }]), "");
  assert.equal(alsoDeletesText([{ one: "shortlink", many: "shortlinks", n: 1 }, { one: "shortlink", many: "shortlinks", n: 2 }]), "Also deletes 3 shortlinks.");
});

test("refusal says where it is still used", () => {
  assert.equal(stillUsedText([{ one: "ticket", many: "tickets", n: 4 }, { one: "task", many: "tasks", n: 1 }, { one: "carousel plan", many: "carousel plans", n: 0 }]), "Still used by 4 tickets and 1 task. Change them first, then delete it.");
  assert.equal(stillUsedText([]), "");
});

test("every parent with children and every list people point at has a rule", () => {
  for (const table of ["tkt_people", "tkt_divisi", "tkt_types", "pain_point_platforms", "pain_point_categories", "buyers", "partners", "org_partners", "products", "product_features", "sub_products", "competitor_profiles", "competitor_products", "story_plan_dates"]) assert.ok(DELETE_RULES[table], table);
  assert.ok(DELETE_RULES.tkt_people.signInColumn, "a person who can sign in is blocked, not deleted");
  assert.deepEqual(DELETE_RULES.partners.children.map((c) => c.table), ["partner_deals", "partner_outreach"]);
});

test("a dropdown keeps the current value", () => {
  assert.deepEqual(withCurrent(["Todo", "Done"], "Blocked"), ["Todo", "Done", "Blocked"]);
  assert.deepEqual(withCurrent(["Todo", "Done"], "Done"), ["Todo", "Done"]);
  assert.deepEqual(withCurrent(["Todo"], null), ["Todo"]);
  assert.equal(optionLabel(["Todo"], "Blocked"), "Blocked (not in list)");
});

test("people: removed and blocked", () => {
  const people = [{ id: "a", nama: "Ani", email: "a@x.id" }, { id: "b", nama: "Budi", email: "b@x.id", blocked: true }, { id: "c", nama: "Cici" }];
  assert.equal(personLabel(people, "a"), "Ani");
  assert.equal(personLabel(people, "zzz"), REMOVED_PERSON);
  assert.deepEqual(invitablePeople(people).map((p) => p.id), ["a"]);
});
