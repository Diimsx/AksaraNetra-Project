/**
 * Daftar keputusan yang bisa ditampilkan ke pengguna.
 *
 * Kenapa berkas ini ada. Snapshot selama ini hanya menyimpan jumlah: 18
 * diperbaiki, 0 perlu diperiksa, 2 dilewati. Angka itu tidak bisa dibantah
 * siapa pun, dan itu masalahnya. Alat yang mengubah halaman orang lain harus
 * mau menunjukkan apa saja yang diubahnya, satu per satu.
 *
 * ATURAN KEAMANAN YANG TIDAK BOLEH DILONGGARKAN.
 * Record dari engine membawa field htmlAfter berisi HTML mentah dari situs
 * yang diaudit, lengkap dengan tag svg dan atributnya. Field itu WAJIB
 * dibuang di sini. Dua alasannya:
 *
 *   1. Ukurannya. Satu record bisa lebih dari dua kilobyte, dan dua puluh
 *      record akan membuat snapshot.json membengkak tanpa manfaat.
 *   2. Keamanan. Menaruh HTML mentah milik situs lain ke dalam JSON yang
 *      dibaca UI kita adalah cara termudah membuat lubang injeksi. UI
 *      menampilkan nilai di sini sebagai teks biasa, dan itu hanya aman
 *      selama isinya memang teks biasa.
 *
 * Modul ini murni. Tidak membaca berkas, tidak menyentuh browser.
 */

/**
 * Batas jumlah baris per kelompok.
 *
 * Bukan untuk menyembunyikan sesuatu. Daftar 200 baris di layar hasil justru
 * membuat orang berhenti membacanya. Kalau ada yang dipotong, jumlah aslinya
 * tetap dilaporkan lewat field total, dan berkas engine-result.json di folder
 * hasil tetap memuat semuanya tanpa dipotong.
 */
export const MAX_DECISIONS_PER_GROUP = 25;

/**
 * Atribut yang isinya memang teks untuk dibacakan pembaca layar.
 *
 * Dipakai untuk menemukan label yang diusulkan. Urutannya sengaja, karena satu
 * record bisa punya lebih dari satu tambalan.
 */
const LABEL_ATTRIBUTES = Object.freeze(["aria-label", "alt", "title"]);

function bacaLabel(record) {
  const patches = Array.isArray(record?.patches) ? record.patches : [];

  for (const attribute of LABEL_ATTRIBUTES) {
    const cocok = patches.find((patch) => patch?.attribute === attribute);
    if (cocok && String(cocok.value ?? "").trim()) return String(cocok.value);
  }

  // Tambalan yang bukan label, misalnya tabindex pada area gulir. Tidak ada
  // teks untuk ditampilkan, dan mengarang teks di sini akan menyesatkan.
  const pertama = patches[0];
  if (pertama?.attribute) return null;

  return null;
}

function bacaAtribut(record) {
  const patches = Array.isArray(record?.patches) ? record.patches : [];
  return patches
    .map((patch) => patch?.attribute)
    .filter((value) => typeof value === "string" && value);
}

/**
 * Menyaring satu record engine menjadi bentuk yang aman ditampilkan.
 *
 * Bentuk keluarannya sengaja datar dan hanya berisi nilai sederhana. Kalau
 * suatu hari engine menambah field baru, field itu tidak akan ikut lolos ke
 * UI tanpa seseorang memutuskannya di sini lebih dulu.
 */
export function decisionFromRecord(record) {
  if (!record?.rule) return null;

  return {
    rule: String(record.rule),
    selector: record.selector ? String(record.selector) : null,
    confidence: typeof record.confidence === "number" ? record.confidence : null,
    source: record.source ? String(record.source) : null,
    reason: record.reason ? String(record.reason) : null,
    label: bacaLabel(record),
    attributes: bacaAtribut(record),
    status: record.status ? String(record.status) : null,
  };
}

function kelompok(records, maxPerGroup) {
  const semua = Array.isArray(records) ? records : [];
  const bersih = semua.map(decisionFromRecord).filter(Boolean);

  return {
    total: bersih.length,
    truncated: bersih.length > maxPerGroup,
    items: bersih.slice(0, maxPerGroup),
  };
}

/**
 * Menyusun tiga kelompok keputusan dari satu laporan engine.
 *
 * applied  sudah diterapkan ke halaman tambalan, keyakinan minimal 0.80
 * review   diusulkan tetapi tidak diterapkan, keyakinan 0.60 sampai 0.79
 * skipped  tidak diusulkan sama sekali, keyakinan di bawah 0.60
 *
 * Kelompok review sering kosong, dan itu bukan alasan untuk menghapusnya dari
 * tampilan. Kelompok yang kosong adalah informasi: pada audit itu, tidak ada
 * satu pun kasus yang menggantung di tengah.
 */
export function summarizeDecisions(report, { maxPerGroup = MAX_DECISIONS_PER_GROUP } = {}) {
  return {
    maxPerGroup,
    applied: kelompok(report?.fixed, maxPerGroup),
    review: kelompok(report?.review, maxPerGroup),
    skipped: kelompok(report?.skipped, maxPerGroup),
    rolledBack: kelompok(report?.rolledBackRecords, maxPerGroup),
  };
}
