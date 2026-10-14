import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_CONTENT_IMAGES,
  buildContentLibraryPayload,
  contentLabels,
  resolveEditedImagePaths,
  storedImagePaths,
} from "./payload.ts";

const VALID = { tipe: "organic", platform: "Instagram", jenis: "Carousel", link: " https://instagram.com/p/abc ", likes: "256", labels: ["Entertain Content"] };

test("tambah dan edit memakai validasi yang sama: link, likes, label wajib", () => {
  assert.throws(() => buildContentLibraryPayload({ ...VALID, link: "  " }), /Content link is required/);
  assert.throws(() => buildContentLibraryPayload({ ...VALID, likes: "" }), /Likes is required/);
  assert.throws(() => buildContentLibraryPayload({ ...VALID, labels: [] }), /at least one label/);
  assert.throws(() => buildContentLibraryPayload({ ...VALID, views: -1 }), /Views must be 0/);
});

test("payload dirapikan: link di-trim, angka jadi number, tipe tak dikenal jadi organic", () => {
  const payload = buildContentLibraryPayload({ ...VALID, tipe: "weird" });
  assert.equal(payload.link, "https://instagram.com/p/abc");
  assert.equal(payload.likes, 256);
  assert.equal(payload.views, 0);
  assert.equal(payload.tipe, "organic");
  assert.equal(buildContentLibraryPayload({ ...VALID, tipe: "ADS" }).tipe, "ads");
});

test("likes 0 tetap sah (bukan dianggap kosong)", () => {
  assert.equal(buildContentLibraryPayload({ ...VALID, likes: 0 }).likes, 0);
});

test("label duplikat beda huruf besar-kecil digabung", () => {
  assert.deepEqual(contentLabels(["Tips", "tips", " Karier "]), ["Tips", "Karier"]);
  assert.deepEqual(contentLabels("Tips, Karier,"), ["Tips", "Karier"]);
});

test("storage_paths lama (JSON string / satu key) terbaca", () => {
  assert.deepEqual(storedImagePaths('["design-assets/a.png","design-assets/b.png"]'), ["design-assets/a.png", "design-assets/b.png"]);
  assert.deepEqual(storedImagePaths("legacy/a.png"), ["legacy/a.png"]);
  assert.deepEqual(storedImagePaths(null), []);
});

test("edit gambar: hapus satu, pertahankan sisanya, tambah baru di belakang", () => {
  const existing = ["design-assets/a.png", "legacy/b.png", "design-assets/c.png"];
  const result = resolveEditedImagePaths(existing, ["legacy/b.png", "design-assets/c.png"], ["design-assets/new.png"]);
  assert.deepEqual(result, ["legacy/b.png", "design-assets/c.png", "design-assets/new.png"]);
});

test("edit gambar: semua gambar boleh dihapus", () => {
  assert.deepEqual(resolveEditedImagePaths(["design-assets/a.png"], [], []), []);
});

test("edit gambar: key milik konten lain tidak bisa disisipkan lewat kept", () => {
  assert.deepEqual(resolveEditedImagePaths(["design-assets/a.png"], ["design-assets/punya-orang.png", "design-assets/a.png"], []), ["design-assets/a.png"]);
});

test("edit gambar: upload baru di luar area design-assets ditolak", () => {
  assert.deepEqual(resolveEditedImagePaths([], [], ["uploads/x.png", "design-assets/ok.png"]), ["design-assets/ok.png"]);
});

test("edit gambar: batas maksimal gambar berlaku", () => {
  const added = Array.from({ length: MAX_CONTENT_IMAGES + 1 }, (_, index) => `design-assets/${index}.png`);
  assert.throws(() => resolveEditedImagePaths([], [], added), /Up to/);
});
