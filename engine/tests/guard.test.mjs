import test from "node:test";
import assert from "node:assert/strict";

import {
  ALWAYS_BLOCKED,
  CHECKED_TYPES,
  createGuardStats,
  decideRequest,
} from "../src/guard/index.mjs";

const TARGET = "https://sulselprov.go.id/";

test("opens the page the user actually asked for", () => {
  const verdict = decideRequest({
    resourceType: "document",
    url: "https://sulselprov.go.id/",
    allowedDocumentUrl: TARGET,
  });

  assert.equal(verdict.allow, true);
  assert.equal(verdict.reason, "document-is-the-target");
});

test("refuses to follow the page to somewhere else", () => {
  // Halaman yang membuka halaman lain sendiri adalah cara paling mudah
  // melewati pemeriksaan alamat, karena hanya alamat pertama yang diperiksa.
  const verdict = decideRequest({
    resourceType: "document",
    url: "https://situs-lain.go.id/",
    allowedDocumentUrl: TARGET,
  });

  assert.equal(verdict.allow, false);
  assert.equal(verdict.reason, "document-not-the-target");
});

test("lets a picture through but not a picture from inside our own network", () => {
  const luar = decideRequest({
    resourceType: "image",
    url: "https://apidev.sulselprov.go.id/storage/foto.jpg",
    allowedDocumentUrl: TARGET,
  });
  assert.equal(luar.allow, true);

  // Satu tag gambar yang menunjuk ke mesin sendiri sudah cukup untuk
  // melewati seluruh kerja src/fetcher kalau pencegat ini tidak ada.
  const dalam = decideRequest({
    resourceType: "image",
    url: "http://localhost/rahasia.png",
    allowedDocumentUrl: TARGET,
  });
  assert.equal(dalam.allow, false);
  assert.equal(dalam.reason, "asset-local-host-name");

  // Alamat lokal dengan port tidak standar tertahan lebih awal, di
  // pemeriksaan port. Alasannya berbeda, tetapi sama sama ditolak.
  const denganPort = decideRequest({
    resourceType: "image",
    url: "http://localhost:8080/rahasia.png",
    allowedDocumentUrl: TARGET,
  });
  assert.equal(denganPort.allow, false);
  assert.equal(denganPort.reason, "asset-port-not-allowed");

  const ipLangsung = decideRequest({
    resourceType: "image",
    url: "http://169.254.169.254/latest/meta-data/",
    allowedDocumentUrl: TARGET,
  });
  assert.equal(ipLangsung.allow, false);
  assert.equal(ipLangsung.reason, "asset-ip-literal-not-allowed");
});

test("never runs a script from the audited site", () => {
  for (const type of ALWAYS_BLOCKED) {
    const verdict = decideRequest({
      resourceType: type,
      url: "https://sulselprov.go.id/app.js",
      allowedDocumentUrl: TARGET,
    });

    assert.equal(verdict.allow, false, `${type} seharusnya ditolak`);
    assert.equal(verdict.reason, `blocked-type-${type}`);
  }

  // Sengaja diperiksa: script tetap ditolak walaupun alamatnya sah dan
  // berasal dari situs yang sedang kita audit sendiri.
  assert.equal(ALWAYS_BLOCKED.includes("script"), true);
});

test("refuses a kind of request it has never seen before", () => {
  // Daftar jenis milik Chromium bisa bertambah di versi berikutnya. Sikap
  // dasarnya harus menolak, supaya jenis baru tidak otomatis dapat izin.
  const verdict = decideRequest({
    resourceType: "webtransport",
    url: "https://sulselprov.go.id/apa-pun",
    allowedDocumentUrl: TARGET,
  });

  assert.equal(verdict.allow, false);
  assert.equal(verdict.reason, "resource-type-not-recognised");

  const kosong = decideRequest({ url: "https://sulselprov.go.id/" });
  assert.equal(kosong.allow, false);
  assert.equal(kosong.reason, "missing-resource-type");
});

test("treats a broken target address as a reason to stop, not to allow", () => {
  const verdict = decideRequest({
    resourceType: "document",
    url: "https://sulselprov.go.id/",
    allowedDocumentUrl: "bukan-alamat",
  });

  assert.equal(verdict.allow, false);
  assert.equal(verdict.reason, "document-target-invalid");
});

test("gives every refusal a sentence a person can read", () => {
  const contoh = [
    { resourceType: "script", url: "https://a.go.id/x.js" },
    { resourceType: "image", url: "http://127.0.0.1/x.png" },
    { resourceType: "beacon", url: "https://a.go.id/x" },
  ];

  for (const item of contoh) {
    const verdict = decideRequest({ ...item, allowedDocumentUrl: TARGET });
    assert.equal(verdict.allow, false);
    assert.equal(typeof verdict.message, "string");
    assert.ok(verdict.message.length > 10, "pesan terlalu pendek untuk dibaca");
  }
});

test("starts counting from zero and knows which types it checks", () => {
  const stats = createGuardStats();

  assert.deepEqual(stats, {
    allowed: 0,
    blocked: 0,
    byType: {},
    blockedHosts: [],
  });

  // Tiga jenis inilah yang boleh lewat setelah diperiksa. Sisanya ditolak.
  assert.deepEqual([...CHECKED_TYPES], ["image", "stylesheet", "font"]);
});
