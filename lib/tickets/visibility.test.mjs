import assert from "node:assert/strict";
import test from "node:test";
import { findTicketPerson, ticketVisibility } from "./visibility.ts";

const people = [
  { id: "p-ani", nama: "Ani", email: "ani@ccc.id", divisi_id: "d-mkt", auth_user_id: "u-ani" },
  { id: "p-budi", nama: "Budi", email: "budi@ccc.id", divisi_id: "d-mkt", auth_user_id: null },
  { id: "p-cici", nama: "Cici", email: "cici@ccc.id", divisi_id: "d-ops", auth_user_id: "u-cici" },
];
const tickets = [
  { id: "t-ani-minta", requester_id: "p-ani", assigned_to_ids: ["p-cici"] },
  { id: "t-ke-ani", requester_id: "p-cici", assigned_to_ids: ["p-ani"] },
  { id: "t-ke-budi", requester_id: "p-cici", assigned_to_ids: ["p-budi"] },
  { id: "t-ops", requester_id: "p-cici", assigned_to_ids: ["p-cici"] },
  { id: "t-lama", requester_id: "p-cici", assigned_to_id: "p-budi" },
  { id: "t-array-kosong", requester_id: "p-cici", assigned_to_ids: [], assigned_to_id: "p-ani" },
];
const visible = (viewer) => tickets.filter(ticketVisibility(viewer, people)).map((ticket) => ticket.id);

test("admin melihat semua tiket", () => {
  assert.equal(visible({ role: "admin", userId: "u-x" }).length, tickets.length);
});

test("staff hanya melihat tiket yang dia minta atau ditugaskan ke dia", () => {
  assert.deepEqual(visible({ role: "staff", userId: "u-ani" }), ["t-ani-minta", "t-ke-ani"]);
});

test("lead melihat tiket yang dia minta + yang ditugaskan ke orang satu divisinya", () => {
  assert.deepEqual(visible({ role: "lead", userId: "u-ani" }), ["t-ani-minta", "t-ke-ani", "t-ke-budi", "t-lama"]);
});

test("akun tanpa auth_user_id dicocokkan lewat email (data lama)", () => {
  assert.equal(findTicketPerson({ userId: "u-budi", email: "BUDI@ccc.id" }, people)?.id, "p-budi");
  assert.deepEqual(visible({ role: "staff", userId: "u-budi", email: "budi@ccc.id" }), ["t-ke-budi", "t-lama"]);
});

test("akun yang tidak terdaftar sebagai orang tiket tidak melihat apa pun", () => {
  assert.deepEqual(visible({ role: "staff", userId: "u-asing", email: "asing@ccc.id" }), []);
  assert.deepEqual(visible({ role: "staff", userId: "", email: "" }), [], "email kosong tidak boleh cocok dengan orang ber-email kosong");
});

test("assigned_to_ids kosong tidak jatuh balik ke assigned_to_id (sama dengan aturan lama)", () => {
  assert.ok(!visible({ role: "staff", userId: "u-ani" }).includes("t-array-kosong"));
});
