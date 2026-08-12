import test from "node:test";
import assert from "node:assert/strict";

import {
  GUARANTEE_SCOPE,
  GUARANTEE_SCOPE_NOTE,
  READER_GUARANTEES,
  guaranteeIds,
  findGuarantee,
  guaranteesForSnapshot,
} from "../src/serializer/guarantees.mjs";

test("every guarantee names a way to check it", () => {
  // Ini aturan terpenting berkas guarantees. Butir tanpa cara memeriksa bukan
  // jaminan, melainkan klaim, dan klaim tanpa bukti adalah hal yang paling
  // mudah dipatahkan juri.
  for (const item of READER_GUARANTEES) {
    assert.equal(typeof item.id, "string", "setiap butir butuh id");
    assert.ok(item.claim.trim().length > 0, `${item.id} butuh claim`);
    assert.ok(item.basis.trim().length > 0, `${item.id} butuh basis`);
    assert.ok(item.checkedBy.trim().length > 0, `${item.id} butuh checkedBy`);
  }
});

test("no two guarantees share an id", () => {
  const ids = guaranteeIds();
  assert.equal(new Set(ids).size, ids.length);
});

test("guarantees cannot be edited by accident at runtime", () => {
  // Daftar ini ikut ditulis ke snapshot. Kalau bisa diubah saat program
  // berjalan, dua situs dalam satu kali build:data bisa punya daftar jaminan
  // yang berbeda tanpa ada yang sadar.
  assert.throws(() => {
    READER_GUARANTEES.push({ id: "palsu" });
  });
  assert.throws(() => {
    READER_GUARANTEES[0].claim = "diubah";
  });
});

test("the scope note refuses to speak for the original site", () => {
  assert.equal(GUARANTEE_SCOPE, "reader-view");
  assert.match(GUARANTEE_SCOPE_NOTE, /tidak berlaku untuk situs aslinya/);
});

test("finds a guarantee by id and gives null for an unknown one", () => {
  assert.equal(findGuarantee("kontras-teks")?.id, "kontras-teks");
  assert.equal(findGuarantee("belum-ada"), null);
});

test("the snapshot shape says plainly that nothing here is measured", () => {
  const bentuk = guaranteesForSnapshot();

  // measured false adalah pagar terhadap kesalahan yang paling mungkin terjadi
  // saat menulis proposal, yaitu menjumlahkan jaminan ini dengan angka tiga
  // rule lalu menyebutnya satu persentase.
  assert.equal(bentuk.measured, false);
  assert.equal(bentuk.scope, "reader-view");
  assert.equal(bentuk.items.length, READER_GUARANTEES.length);

  bentuk.items[0].claim = "diubah";
  assert.notEqual(READER_GUARANTEES[0].claim, "diubah", "salinan, bukan rujukan");
});

test("no guarantee claims anything about the original site", () => {
  // Penjaga terhadap kalimat yang menyeret klaim keluar dari batas reader view.
  for (const item of READER_GUARANTEES) {
    assert.equal(
      /seluruh situs|situs ini sudah|seluruh halaman/i.test(item.claim),
      false,
      `${item.id} mengklaim terlalu jauh`,
    );
  }
});
