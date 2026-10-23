import assert from "node:assert/strict";
import test from "node:test";
import { decodeText, detectDelimiter, parseDate, parseNumber, splitCsvLine, stripSepLine } from "./csv-text.ts";

test("decodes UTF-8 with BOM and UTF-16 (Meta Insights)", () => {
  assert.equal(decodeText(new TextEncoder().encode("﻿Post ID,Views")), "Post ID,Views");
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('"Views"\r\n', "utf16le")]);
  assert.equal(decodeText(utf16), '"Views"\r\n');
});

test("detects ',', ';' and tab", () => {
  assert.equal(detectDelimiter("a,b,c\n1,2,3"), ",");
  assert.equal(detectDelimiter("Nama;Email;WA\nAni;a@x.com;0812"), ";");
  assert.equal(detectDelimiter("a\tb\n1\t2"), "\t");
  // A comma inside quotes does not win over the real ';' delimiter.
  assert.equal(detectDelimiter('Nama;Catatan\n"Ani";"Suka FMCG, Finance"'), ";");
  assert.deepEqual(stripSepLine("sep=;\nA;B"), { text: "A;B", delimiter: ";" });
});

test("splits quoted cells", () => {
  assert.deepEqual(splitCsvLine('"2026-09-07T00:00:00","1,234"'), ["2026-09-07T00:00:00", "1,234"]);
  assert.deepEqual(splitCsvLine('a,"say ""hi""",c'), ["a", 'say "hi"', "c"]);
});

test("numbers in the formats people type", () => {
  assert.equal(parseNumber("1,234"), 1234);
  assert.equal(parseNumber("1.234.567"), 1234567);
  assert.equal(parseNumber("Rp 99.000"), 99000);
  assert.equal(parseNumber("3.57"), 3.57);
  assert.equal(parseNumber("3,5"), 3.5);
  assert.equal(parseNumber("12%"), 12);
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("abc"), null);
});

test("dates: ISO, day-first, Meta month-first, names, Excel serials", () => {
  assert.equal(parseDate("2026-11-30"), "2026-11-30");
  assert.equal(parseDate("30/11/2026"), "2026-11-30");
  assert.equal(parseDate("01-07-2026 10:24"), "2026-07-01");
  assert.equal(parseDate("06/30/2026 19:00", "mdy"), "2026-06-30");
  assert.equal(parseDate("03/04/2026", "mdy"), "2026-03-04");
  assert.equal(parseDate("03/04/2026", "dmy"), "2026-04-03");
  assert.equal(parseDate("5 Okt 2026"), "2026-10-05");
  assert.equal(parseDate("31 August 2026"), "2026-08-31");
  assert.equal(parseDate("46326"), "2026-10-31");
  assert.equal(parseDate("31/02/2026"), null);
  assert.equal(parseDate("soon"), null);
});
