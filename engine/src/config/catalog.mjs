/**
 * Katalog situs demo.
 *
 * Satu-satunya sumber kebenaran. Frontend membaca daftar ini, bukan mengetik
 * ulang daftarnya sendiri. Dua daftar yang diketik terpisah pasti akan berbeda
 * suatu hari.
 *
 * Sebuah situs hanya boleh berstatus "verified" kalau engine sudah pernah
 * dijalankan padanya dan baseline-nya diulang minimal tiga kali di hari yang
 * berbeda. Aturan ini lahir dari temuan riset kita sendiri: satu kali audit
 * hanyalah potret sesaat.
 */

export const CATALOG = Object.freeze([
  Object.freeze({
    id: "sulselprov",
    name: "Pemerintah Provinsi Sulawesi Selatan",
    shortName: "Prov. Sulawesi Selatan",
    host: "sulselprov.go.id",
    url: "https://sulselprov.go.id",
    status: "verified",
    baselineRuns: 3,
    lastVerifiedOn: "2026-08-08",
    note: "Target utama. Baseline 20 node stabil di banyak kali percobaan.",
  }),
  Object.freeze({
    id: "kepriprov",
    name: "Pemerintah Provinsi Kepulauan Riau",
    shortName: "Prov. Kepulauan Riau",
    host: "kepriprov.go.id",
    url: "https://kepriprov.go.id",
    status: "verified",
    baselineRuns: 2,
    lastVerifiedOn: "2026-08-08",
    note: "Bukti bahwa engine bekerja tanpa mengubah kode. Baseline 8 node, baru dua kali dijalankan.",
  }),
  Object.freeze({
    id: "bengkuluprov",
    name: "Pemerintah Provinsi Bengkulu",
    shortName: "Prov. Bengkulu",
    host: "bengkuluprov.go.id",
    url: "https://bengkuluprov.go.id",
    status: "candidate",
    baselineRuns: 0,
    lastVerifiedOn: null,
    note: "Disebut stabil pada riset 12 situs, tetapi engine belum pernah dijalankan di sini.",
  }),
  Object.freeze({
    id: "lampungprov",
    name: "Pemerintah Provinsi Lampung",
    shortName: "Prov. Lampung",
    host: "lampungprov.go.id",
    url: "https://lampungprov.go.id",
    status: "candidate",
    baselineRuns: 0,
    lastVerifiedOn: null,
    note: "Disebut stabil pada riset 12 situs, tetapi engine belum pernah dijalankan di sini.",
  }),
]);

/**
 * Situs yang sengaja dikeluarkan, beserta alasannya.
 *
 * Daftar ini bukan sampah. Daftar ini mencegah orang menambahkannya kembali
 * karena lupa, dan isinya adalah bahan bukti untuk proposal.
 */
export const EXCLUDED_SITES = Object.freeze([
  Object.freeze({
    host: "jogjaprov.go.id",
    reason:
      "Tidak stabil. Audit menemukan 19 affected node, lalu tinggal 1 node keesokan harinya.",
    observedOn: "2026-08-02",
  }),
  Object.freeze({
    host: "babelprov.go.id",
    reason:
      "Tidak stabil. Audit menemukan 0 affected node, lalu melonjak menjadi 24 node.",
    observedOn: "2026-08-02",
  }),
]);

export function listDemoSites() {
  return CATALOG.filter((entry) => entry.status === "verified");
}

export function listCandidateSites() {
  return CATALOG.filter((entry) => entry.status === "candidate");
}

export function getCatalogEntry(id) {
  return CATALOG.find((entry) => entry.id === id) || null;
}

export function isExcluded(host) {
  const needle = String(host ?? "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  return EXCLUDED_SITES.some((entry) => entry.host === needle);
}
