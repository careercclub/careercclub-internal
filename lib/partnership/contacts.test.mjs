import assert from "node:assert/strict";
import test from "node:test";
import { contactsOf, contactsSearchText, contactsText, picSummary, readContacts, withContacts } from "./contacts.ts";

const rina = { name: "Rina", position: "HR Manager", phone: "0812", email: "rina@x.id", linkedin: "" };
const budi = { name: "Budi", position: "Head of Talent", phone: "", email: "budi@x.id", linkedin: "https://linkedin.com/in/budi" };

test("a saved list keeps every PIC and drops empty rows", () => {
  assert.deepEqual(readContacts([rina, { name: " ", email: "" }, budi]), [rina, budi]);
  assert.deepEqual(readContacts(JSON.stringify([budi])), [budi]);
  assert.deepEqual(readContacts("not json"), []);
  assert.deepEqual(readContacts(null), []);
});

test("rows saved before Putaran 61 show their one PIC", () => {
  assert.deepEqual(contactsOf({ contacts: [], contact_name: "Rina", pos: "HR Manager", contact_phone: "0812", contact_email: "rina@x.id", li: "" }), [rina]);
  assert.deepEqual(contactsOf({ contacts: [], contact_name: "", pos: null }), []);
  assert.deepEqual(contactsOf({ contacts: [budi], contact_name: "Old name" }), [budi]);
});

test("every save keeps the older columns equal to the first PIC", () => {
  const saved = withContacts({ name: "PT A", contacts: [budi, rina], contact_name: "stale" });
  assert.deepEqual(saved.contacts, [budi, rina]);
  assert.equal(saved.contact_name, "Budi");
  assert.equal(saved.contact_email, "budi@x.id");
  assert.equal(saved.li, "https://linkedin.com/in/budi");
  assert.equal(saved.contact_phone, null);
});

test("removing every PIC clears the older columns too", () => {
  const saved = withContacts({ contacts: [], contact_name: "Rina" });
  assert.deepEqual(saved.contacts, []);
  assert.equal(saved.contact_name, null);
});

test("the Claude parser (older columns only) becomes a one-PIC list", () => {
  const saved = withContacts({ name: "PT A", contacts: null, contact_name: "Rina", pos: "HR Manager", contact_phone: "0812", contact_email: "rina@x.id", li: null });
  assert.deepEqual(saved.contacts, [rina]);
  assert.equal(saved.contact_name, "Rina");
});

test("card, CSV and search show every PIC", () => {
  assert.equal(picSummary([rina, budi]), "Rina +1");
  assert.equal(picSummary([rina]), "Rina");
  assert.equal(picSummary([]), "");
  assert.equal(contactsText([rina, budi]), "Rina (HR Manager) 0812 rina@x.id; Budi (Head of Talent) budi@x.id https://linkedin.com/in/budi");
  assert.match(contactsSearchText([rina, budi]), /Budi/);
});
