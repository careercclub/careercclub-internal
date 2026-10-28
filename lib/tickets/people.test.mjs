import assert from "node:assert/strict";
import test from "node:test";
import { isBlocked, pickablePeople } from "./people.ts";

const people = [{ id: "1", nama: "Ani" }, { id: "2", nama: "ariel", blocked: true }, { id: "3", nama: "Falah Akbar", blocked: true }];

test("blocked people are not offered; someone already chosen stays visible", () => {
  assert.deepEqual(pickablePeople(people).map((p) => p.id), ["1"]);
  assert.deepEqual(pickablePeople(people, ["3"]).map((p) => p.id), ["1", "3"]);
  assert.equal(isBlocked(people[1]), true);
  assert.equal(isBlocked(people[0]), false);
});
