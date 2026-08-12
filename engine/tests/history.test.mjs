import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_HISTORY_ENTRIES,
  createHistory,
  historyEntryFromSnapshot,
  appendEntry,
  describeStability,
  summarizeHistory,
} from "../src/history/index.mjs";

function snapshotPalsu(waktu, beforeTotal, afterTotal = 0) {
  return {
    capturedAt: waktu,
    engineVersion: "0.2.1",
    source: { status: 200 },
    summary: { beforeTotal, afterTotal, reductionPercent: 50 },
    rules: { "button-name": { before: beforeTotal, after: afterTotal, reduction: 1 } },
    guard: { blocked: 12, allowed: 3 },
  };
}

test("keeps only the numbers, never the whole snapshot", () => {
  const entri = historyEntryFromSnapshot(snapshotPalsu("2026-08-09T10:00:00Z", 20, 2));

  assert.equal(entri.beforeTotal, 20);
  assert.equal(entri.afterTotal, 2);
  assert.equal(entri.guardBlocked, 12);
  assert.equal(entri.rules["button-name"].before, 20);

  // Field yang tidak diminta tidak boleh menyelip masuk. Riwayat 30 entri yang
  // masing masing membawa views dan files akan jadi berkas yang tidak bisa
  // dibaca manusia.
  assert.equal("views" in entri, false);
  assert.equal("reduction" in entri.rules["button-name"], false);
});

test("refuses a snapshot with no time on it", () => {
  assert.equal(historyEntryFromSnapshot({ summary: { beforeTotal: 5 } }), null);
});

test("newest entry comes first", () => {
  let riwayat = createHistory();
  riwayat = appendEntry(riwayat, "sulselprov", { capturedAt: "2026-08-07T00:00:00Z", beforeTotal: 20 });
  riwayat = appendEntry(riwayat, "sulselprov", { capturedAt: "2026-08-09T00:00:00Z", beforeTotal: 18 });
  riwayat = appendEntry(riwayat, "sulselprov", { capturedAt: "2026-08-08T00:00:00Z", beforeTotal: 19 });

  const waktu = riwayat.sites.sulselprov.map((item) => item.capturedAt);
  assert.deepEqual(waktu, [
    "2026-08-09T00:00:00Z",
    "2026-08-08T00:00:00Z",
    "2026-08-07T00:00:00Z",
  ]);
});

test("running the same audit twice replaces it instead of stacking", () => {
  let riwayat = createHistory();
  riwayat = appendEntry(riwayat, "kepriprov", { capturedAt: "2026-08-09T00:00:00Z", beforeTotal: 8 });
  riwayat = appendEntry(riwayat, "kepriprov", { capturedAt: "2026-08-09T00:00:00Z", beforeTotal: 8 });

  assert.equal(riwayat.sites.kepriprov.length, 1);
});

test("never keeps more than the limit, and drops the oldest first", () => {
  // Tanggalnya dihitung dari satu titik awal, bukan ditempel dari angka hari,
  // supaya tidak ada tanggal mustahil seperti 35 September di dalam test.
  const awal = Date.UTC(2026, 8, 1);
  const jumlah = MAX_HISTORY_ENTRIES + 5;

  let riwayat = createHistory();
  for (let hari = 0; hari < jumlah; hari += 1) {
    riwayat = appendEntry(riwayat, "sulselprov", {
      capturedAt: new Date(awal + hari * 86400000).toISOString(),
      beforeTotal: hari,
    });
  }

  const daftar = riwayat.sites.sulselprov;
  assert.equal(daftar.length, MAX_HISTORY_ENTRIES);

  // Yang dibuang harus yang paling tua. Entri terbaru adalah hari terakhir,
  // dan entri terlama yang masih tersimpan adalah hari ke 5.
  assert.equal(daftar[0].beforeTotal, jumlah - 1);
  assert.equal(daftar[daftar.length - 1].beforeTotal, jumlah - MAX_HISTORY_ENTRIES);
});

test("does not modify the history it was given", () => {
  const awal = createHistory();
  const sesudah = appendEntry(awal, "sulselprov", { capturedAt: "2026-08-09T00:00:00Z", beforeTotal: 1 });

  assert.equal(Object.keys(awal.sites).length, 0);
  assert.equal(Object.keys(sesudah.sites).length, 1);
});

test("two matching audits are not yet proof of a stable site", () => {
  // Ambang tiga audit ini bukan angka bulat yang dipilih sembarangan. Jogja
  // pernah terlihat konsisten pada dua audit lalu berubah pada audit ketiga.
  const hasil = describeStability([{ beforeTotal: 20 }, { beforeTotal: 20 }]);

  assert.equal(hasil.stable, false);
  assert.match(hasil.note, /minimal 3 audit/);
});

test("three matching audits are called stable", () => {
  const hasil = describeStability([
    { beforeTotal: 20 },
    { beforeTotal: 20 },
    { beforeTotal: 20 },
  ]);

  assert.equal(hasil.stable, true);
  assert.equal(hasil.spread, 0);
});

test("a moving number is reported as the site changing, not as a bug", () => {
  const hasil = describeStability([
    { beforeTotal: 24 },
    { beforeTotal: 8 },
    { beforeTotal: 19 },
  ]);

  assert.equal(hasil.stable, false);
  assert.equal(hasil.beforeMin, 8);
  assert.equal(hasil.beforeMax, 24);
  assert.equal(hasil.spread, 16);
  assert.match(hasil.note, /bukan kesalahan alat/);
});

test("an empty history says so instead of pretending zero", () => {
  const hasil = describeStability([]);

  // Nol audit dan nol masalah adalah dua hal yang sangat berbeda, dan
  // menyamakannya adalah kesalahan yang sudah kami sepakati untuk dihindari.
  assert.equal(hasil.runs, 0);
  assert.equal(hasil.beforeMin, null);
  assert.match(hasil.note, /Belum ada audit/);
});

test("summarizes every site and points at its latest entry", () => {
  let riwayat = createHistory();
  riwayat = appendEntry(riwayat, "sulselprov", { capturedAt: "2026-08-08T00:00:00Z", beforeTotal: 20 });
  riwayat = appendEntry(riwayat, "sulselprov", { capturedAt: "2026-08-09T00:00:00Z", beforeTotal: 18 });
  riwayat = appendEntry(riwayat, "kepriprov", { capturedAt: "2026-08-09T00:00:00Z", beforeTotal: 8 });

  const ringkas = summarizeHistory(riwayat);

  assert.equal(ringkas.sulselprov.runs, 2);
  assert.equal(ringkas.sulselprov.latest.beforeTotal, 18);
  assert.equal(ringkas.kepriprov.runs, 1);
});
