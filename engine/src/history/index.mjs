/**
 * Riwayat hasil audit.
 *
 * Kenapa berkas ini ada. Temuan riset terkuat yang kita punya adalah bahwa
 * satu audit hanya potret sesaat. Jogja pernah 19 node lalu 1 node keesokan
 * harinya. Babel pernah 0 lalu 24. Kepri pernah 37 node kontras lalu 11,
 * tanpa satu pun tambalan warna dari kita.
 *
 * Masalahnya, otomatisasi harian kita menimpa hasil sebelumnya, jadi bukti
 * paling kuat itu terbuang setiap hari. Modul ini menyimpannya.
 *
 * Murni, tanpa berkas dan tanpa browser, supaya bisa diuji tanpa jaringan.
 * Yang menulis ke disk adalah scripts/build-data.mjs.
 */

export const HISTORY_FORMAT_VERSION = 1;

/**
 * Batas jumlah entri per situs.
 *
 * 30 dipilih karena cukup untuk melihat pola satu bulan, dan karena berkas
 * yang terus bertambah tanpa batas akan membuat repo membengkak sampai
 * seseorang menghapusnya diam diam, dan saat itu seluruh riwayatnya hilang.
 */
export const MAX_HISTORY_ENTRIES = 30;

export function createHistory() {
  return {
    formatVersion: HISTORY_FORMAT_VERSION,
    maxEntries: MAX_HISTORY_ENTRIES,
    sites: {},
  };
}

/**
 * Mengambil hanya angka yang dibutuhkan untuk melihat pola dari waktu ke waktu.
 *
 * Sengaja tidak menyimpan seluruh snapshot. Riwayat 30 salinan snapshot penuh
 * berarti menyimpan ratusan kilobyte HTML yang tidak akan pernah dibaca siapa
 * pun, dan membuat berkas riwayatnya mustahil dilihat manusia.
 */
export function historyEntryFromSnapshot(snapshot) {
  if (!snapshot?.capturedAt) return null;

  const rules = {};
  for (const [name, value] of Object.entries(snapshot.rules || {})) {
    rules[name] = {
      before: value?.before ?? 0,
      after: value?.after ?? 0,
    };
  }

  return {
    capturedAt: snapshot.capturedAt,
    engineVersion: snapshot.engineVersion ?? null,
    status: snapshot.source?.status ?? null,
    beforeTotal: snapshot.summary?.beforeTotal ?? 0,
    afterTotal: snapshot.summary?.afterTotal ?? 0,
    reductionPercent: snapshot.summary?.reductionPercent ?? 0,
    rules,

    // Pencegat mengubah angkanya, karena script diblokir dan carousel tidak
    // berputar. Tanpa mencatat ini, dua entri dengan angka berbeda akan
    // terlihat seperti situsnya berubah, padahal cara mengukurnya yang berbeda.
    guardBlocked: snapshot.guard?.blocked ?? null,
  };
}

/**
 * Menambahkan satu entri untuk sebuah situs.
 *
 * Selalu mengembalikan objek baru dan tidak pernah mengubah masukannya, supaya
 * pemanggil tidak bisa merusak riwayat lama karena keliru menyimpan urutan.
 *
 * Entri terbaru ada di depan. Entri dengan capturedAt yang sama dianggap
 * pengulangan dan menggantikan yang lama, bukan menumpuk, karena satu
 * workflow yang dijalankan ulang tidak boleh terlihat seperti dua hari.
 */
export function appendEntry(history, siteId, entry, maxEntries = MAX_HISTORY_ENTRIES) {
  if (!siteId) throw new Error("Riwayat butuh siteId.");
  if (!entry?.capturedAt) throw new Error("Entri riwayat butuh capturedAt.");

  const base = history?.sites ? history : createHistory();
  const previous = base.sites[siteId] || [];
  const tanpaKembar = previous.filter((item) => item.capturedAt !== entry.capturedAt);

  const gabungan = [entry, ...tanpaKembar]
    .sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)))
    .slice(0, Math.max(1, maxEntries));

  return {
    ...base,
    formatVersion: HISTORY_FORMAT_VERSION,
    maxEntries,
    sites: { ...base.sites, [siteId]: gabungan },
  };
}

/**
 * Menghitung seberapa jauh angka sebuah situs bergerak antar audit.
 *
 * Ini bukan hiasan grafik. Ini yang membedakan klaim "situs ini punya 20
 * masalah" dari klaim "situs ini punya antara 8 dan 24 masalah tergantung
 * kapan diperiksa". Kalimat kedua yang benar, dan hanya kalimat kedua yang
 * bisa kita pertahankan kalau juri memeriksa sendiri di hari yang lain.
 *
 * stable bernilai true hanya kalau ada minimal tiga audit dan semuanya
 * menghasilkan angka yang sama. Dua audit yang sama bukan bukti stabil, itu
 * baru kebetulan yang belum terbantah.
 */
export function describeStability(entries = []) {
  const angka = entries
    .map((item) => item?.beforeTotal)
    .filter((value) => typeof value === "number");

  if (angka.length === 0) {
    return {
      runs: 0,
      beforeMin: null,
      beforeMax: null,
      spread: null,
      stable: false,
      note: "Belum ada audit yang tercatat.",
    };
  }

  const beforeMin = Math.min(...angka);
  const beforeMax = Math.max(...angka);
  const spread = beforeMax - beforeMin;
  const stable = angka.length >= 3 && spread === 0;

  let note;
  if (angka.length < 3) {
    note =
      `Baru ${angka.length} audit tercatat. Butuh minimal 3 audit di hari ` +
      "yang berbeda sebelum angkanya boleh disebut mewakili situs ini.";
  } else if (stable) {
    note =
      `${angka.length} audit menghasilkan angka yang sama, yaitu ${beforeMax}. ` +
      "Situs ini cukup stabil untuk dijadikan contoh.";
  } else {
    note =
      `${angka.length} audit menghasilkan angka antara ${beforeMin} dan ` +
      `${beforeMax}. Selisih ${spread} node ini bukan kesalahan alat, ` +
      "melainkan tanda halaman aslinya berubah antar hari.";
  }

  return { runs: angka.length, beforeMin, beforeMax, spread, stable, note };
}

/**
 * Ringkasan seluruh situs, dipakai UI supaya tidak perlu menghitung sendiri.
 */
export function summarizeHistory(history) {
  const sites = history?.sites || {};
  const hasil = {};

  for (const [siteId, entries] of Object.entries(sites)) {
    hasil[siteId] = {
      ...describeStability(entries),
      latest: entries[0] || null,
      entries,
    };
  }

  return hasil;
}
