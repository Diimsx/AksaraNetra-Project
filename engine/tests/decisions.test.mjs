import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_DECISIONS_PER_GROUP,
  decisionFromRecord,
  summarizeDecisions,
} from "../src/decisions/index.mjs";

// Bentuk record di bawah disalin dari engine-result.json hasil run nyata pada
// sulselprov.go.id, bukan dikarang, supaya test ini gagal kalau bentuk data
// engine berubah tanpa ada yang memberi tahu.
const RECORD_NYATA = {
  rule: "link-name",
  selector: ".bg-gradient-to-tr",
  confidence: 0.95,
  source: "destination-domain",
  reason: "Recognized social destination",
  patches: [{ attribute: "aria-label", value: "Buka Instagram Sulselprov" }],
  status: "applied",
  appliedPatches: [
    { attribute: "aria-label", oldValue: null, newValue: "Buka Instagram Sulselprov" },
  ],
  htmlAfter:
    '<a href="https://www.instagram.com/sulselprov" class="flex h-12 w-12"><svg><rect /></svg></a>',
};

test("throws away the raw site HTML", () => {
  const hasil = decisionFromRecord(RECORD_NYATA);

  // Ini pemeriksaan keamanan, bukan pemeriksaan ukuran berkas. HTML mentah
  // milik situs lain tidak boleh masuk ke JSON yang dibaca UI kita.
  assert.equal("htmlAfter" in hasil, false);
  assert.equal("appliedPatches" in hasil, false);
  assert.equal(JSON.stringify(hasil).includes("<svg"), false);
});

test("keeps exactly the fields a person needs to judge the change", () => {
  const hasil = decisionFromRecord(RECORD_NYATA);

  assert.equal(hasil.rule, "link-name");
  assert.equal(hasil.selector, ".bg-gradient-to-tr");
  assert.equal(hasil.confidence, 0.95);
  assert.equal(hasil.source, "destination-domain");
  assert.equal(hasil.reason, "Recognized social destination");
  assert.equal(hasil.label, "Buka Instagram Sulselprov");
  assert.deepEqual(hasil.attributes, ["aria-label"]);
});

test("a patch that is not a label has no label to show", () => {
  // Area gulir ditambal dengan tabindex, bukan dengan teks. Mengarang teks di
  // sini akan membuat laporan mengaku menambahkan nama yang tidak pernah ada.
  const hasil = decisionFromRecord({
    rule: "scrollable-region-focusable",
    selector: ".max-h-\\[240px\\]",
    confidence: 0.9,
    patches: [{ attribute: "tabindex", value: "0" }],
  });

  assert.equal(hasil.label, null);
  assert.deepEqual(hasil.attributes, ["tabindex"]);
});

test("prefers aria-label when a record carries more than one text patch", () => {
  const hasil = decisionFromRecord({
    rule: "button-name",
    patches: [
      { attribute: "title", value: "Judul" },
      { attribute: "aria-label", value: "Nama yang dibacakan" },
    ],
  });

  assert.equal(hasil.label, "Nama yang dibacakan");
});

test("ignores a record with no rule on it", () => {
  assert.equal(decisionFromRecord({ selector: ".apa-saja" }), null);
  assert.equal(decisionFromRecord(null), null);
});

test("groups the three kinds of decision separately", () => {
  const hasil = summarizeDecisions({
    fixed: [RECORD_NYATA],
    review: [{ rule: "button-name", confidence: 0.6, reason: "conflicting-signals" }],
    skipped: [{ rule: "button-name", confidence: 0, reason: "unknown-button" }],
  });

  assert.equal(hasil.applied.total, 1);
  assert.equal(hasil.review.total, 1);
  assert.equal(hasil.skipped.total, 1);
  assert.equal(hasil.applied.truncated, false);
});

test("an empty review group still exists", () => {
  // Pada run nyata 0.1.3, review memang nol. Kelompok kosong adalah informasi,
  // yaitu tidak ada kasus yang menggantung, jadi UI tetap perlu menerimanya
  // sebagai bentuk yang lengkap dan bukan sebagai undefined.
  const hasil = summarizeDecisions({ fixed: [RECORD_NYATA] });

  assert.equal(hasil.review.total, 0);
  assert.deepEqual(hasil.review.items, []);
  assert.equal(hasil.skipped.total, 0);
});

test("a laporan with nothing in it does not crash", () => {
  const hasil = summarizeDecisions(undefined);
  assert.equal(hasil.applied.total, 0);
});

test("says out loud when the list was cut short", () => {
  const banyak = Array.from({ length: MAX_DECISIONS_PER_GROUP + 3 }, (_, index) => ({
    rule: "button-name",
    selector: `.tombol-${index}`,
    patches: [{ attribute: "aria-label", value: `Tombol ${index}` }],
  }));

  const hasil = summarizeDecisions({ fixed: banyak });

  assert.equal(hasil.applied.total, MAX_DECISIONS_PER_GROUP + 3);
  assert.equal(hasil.applied.items.length, MAX_DECISIONS_PER_GROUP);
  assert.equal(hasil.applied.truncated, true);
});
