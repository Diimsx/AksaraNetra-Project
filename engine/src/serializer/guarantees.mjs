/**
 * Jaminan tampilan mudah dibaca.
 *
 * Kenapa berkas ini ada. Selama ini kita hanya melaporkan tiga rule yang
 * ditambal otomatis di halaman aslinya, padahal tampilan mudah dibaca
 * mengurus jauh lebih banyak hal. Akibatnya kerja kita terlihat lebih kecil
 * daripada kenyataannya.
 *
 * Bedanya dengan tiga rule itu penting, dan jangan sampai tercampur:
 *
 *   Tiga rule di halaman asli  -> hasil perbaikan, diukur sebelum dan sesudah,
 *                                 boleh punya angka persen, dan bisa gagal.
 *   Jaminan di tampilan ini    -> bukan perbaikan, melainkan akibat dari kita
 *                                 yang membangun halamannya sendiri. Tidak
 *                                 punya angka persen, karena tidak ada
 *                                 keadaan "sebelum" untuk dibandingkan.
 *
 * Aturan keras untuk berkas ini: satu butir hanya boleh ada di sini kalau ada
 * cara memeriksanya secara otomatis. Kolom checkedBy bukan hiasan. Kalau
 * sebuah butir tidak bisa diperiksa, dia bukan jaminan, dia harapan, dan
 * tempatnya di dokumen batasan, bukan di sini.
 */

/**
 * Batas berlakunya seluruh jaminan di bawah.
 *
 * Ikut disimpan ke dalam data, bukan hanya ditulis di UI, supaya kalimat ini
 * tidak bisa hilang karena seseorang menyalin angkanya ke slide lain.
 */
export const GUARANTEE_SCOPE = "reader-view";

export const GUARANTEE_SCOPE_NOTE =
  "Seluruh jaminan berikut hanya berlaku untuk tampilan mudah dibaca yang " +
  "kami hasilkan sendiri. Jaminan ini tidak berlaku untuk situs aslinya, dan " +
  "tidak berarti situs aslinya sudah memenuhi WCAG.";

/**
 * Daftar jaminan.
 *
 * id        dipakai UI dan test, jangan diubah setelah dipakai
 * claim     kalimat untuk manusia, bukan istilah teknis
 * basis     alasan teknisnya benar, ditulis supaya bisa dibantah orang lain
 * wcag      acuan kriterianya, kosong kalau memang bukan kriteria WCAG
 * checkedBy cara membuktikannya, harus benar benar dijalankan
 */
export const READER_GUARANTEES = Object.freeze([
  Object.freeze({
    id: "kontras-teks",
    claim: "Semua teks bisa dibaca dengan kontras tinggi.",
    basis:
      "Warna tidak diambil dari situs aslinya. Teks #1a1a1a di atas latar " +
      "#ffffff berada di kisaran 17:1, jauh di atas ambang 7:1.",
    wcag: "1.4.6 Kontras (Lebih Tinggi), tingkat AAA",
    checkedBy: "npm run test:reader, aturan color-contrast dan color-contrast-enhanced",
  }),
  Object.freeze({
    id: "urutan-heading",
    claim: "Tingkat judul tidak pernah melompat.",
    basis:
      "normalizeOutline menurunkan setiap judul maksimal satu tingkat dari " +
      "judul sebelumnya. Halaman yang loncat dari h2 ke h5 membuat pengguna " +
      "NVDA yang menekan H mengira ada bagian yang terlewat.",
    wcag: "1.3.1 Informasi dan Relasi",
    checkedBy: "npm run test:reader, aturan heading-order",
  }),
  Object.freeze({
    id: "satu-judul-utama",
    claim: "Ada tepat satu judul utama, dan tidak ada judul kembar.",
    basis:
      "h1 hanya dipakai judul halaman. dedupeHeadings membuang judul yang " +
      "muncul dua kali dan mempertahankan kemunculan yang punya tautan.",
    wcag: "2.4.6 Judul dan Label",
    checkedBy: "npm run test:reader, hitungan h1 dan pemeriksaan judul kembar",
  }),
  Object.freeze({
    id: "tanpa-script",
    claim: "Tidak ada satu pun script dari situs aslinya yang ikut berjalan.",
    basis:
      "Serializer membuang tag script dan atribut penangan kejadian, dan " +
      "pencegat di src/guard menolak jenis permintaan script sejak awal.",
    wcag: "",
    checkedBy: "npm run test:reader, pencarian tag script, atribut on, dan skema javascript:",
  }),
  Object.freeze({
    id: "gambar-tanpa-karangan",
    claim:
      "Gambar tanpa keterangan disembunyikan dari pembaca layar, bukan dikarang.",
    basis:
      "Gambar tanpa alt diberi alt kosong dan role presentation. Nama berkas " +
      "yang dibacakan huruf per huruf lebih buruk daripada diam. Kami tidak " +
      "pernah menebak isi gambar.",
    wcag: "1.1.1 Konten Non-teks",
    checkedBy: "npm run test:reader, aturan image-alt",
  }),
  Object.freeze({
    id: "bahasa-halaman",
    claim: "Bahasa halaman dinyatakan, sehingga pembaca layar memakai lafal yang benar.",
    basis:
      "Atribut lang selalu ditulis di tag html. Tanpa itu, NVDA berbahasa " +
      "Inggris akan melafalkan teks Indonesia dengan aksen yang sulit dipahami.",
    wcag: "3.1.1 Bahasa Halaman",
    checkedBy: "npm run test:reader, aturan html-has-lang dan html-lang-valid",
  }),
  Object.freeze({
    id: "judul-dokumen",
    claim: "Halaman punya judul dokumen yang berarti.",
    basis:
      "Judul diambil dari judul halaman aslinya, dan jatuh ke nama situs " +
      "kalau judulnya kosong. Judul dokumen adalah hal pertama yang " +
      "diucapkan pembaca layar saat halaman terbuka.",
    wcag: "2.4.2 Halaman Berjudul",
    checkedBy: "npm run test:reader, aturan document-title",
  }),
  Object.freeze({
    id: "lewati-ke-isi",
    claim: "Ada tautan untuk langsung melompat ke isi utama.",
    basis:
      "Tautan lewati adalah elemen pertama yang bisa difokus, dan menunjuk " +
      "ke landmark main. Tanpa itu, pengguna keyboard harus melewati seluruh " +
      "bagian atas halaman setiap kali berpindah halaman.",
    wcag: "2.4.1 Melewati Blok",
    checkedBy: "npm run test:reader, aturan bypass",
  }),
  Object.freeze({
    id: "penanda-wilayah",
    claim: "Halaman punya penanda wilayah, sehingga bisa dijelajahi per bagian.",
    basis:
      "header, main, dan footer selalu ada. Pengguna NVDA menekan D untuk " +
      "berpindah antar wilayah, dan halaman tanpa penanda membuat tombol itu " +
      "tidak berguna.",
    wcag: "1.3.1 Informasi dan Relasi",
    checkedBy: "npm run test:reader, aturan landmark-one-main dan region",
  }),
  Object.freeze({
    id: "jarak-teks",
    claim: "Jarak antar baris dan antar paragraf cukup lega, dan tetap lega saat diubah.",
    basis:
      "line-height 1.7 dan jarak paragraf di atas 2em ditulis dengan satuan " +
      "relatif, tanpa tinggi tetap dalam piksel. Teks tidak akan terpotong " +
      "kalau pembaca memaksa jarak yang lebih besar lewat pengaturannya sendiri.",
    wcag: "1.4.12 Jarak Teks",
    checkedBy: "tests/serializer.test.mjs, pemeriksaan aturan CSS yang wajib ada",
  }),
  Object.freeze({
    id: "satu-kolom",
    claim: "Isi tetap terbaca di layar sempit dan pada perbesaran 200 persen.",
    basis:
      "Tata letaknya satu kolom dengan lebar maksimum dalam satuan rem, tanpa " +
      "lebar tetap dalam piksel, sehingga tidak pernah muncul gulir mendatar.",
    wcag: "1.4.10 Penataan Ulang",
    checkedBy: "npm run test:reader, pemindaian pada lebar 320 piksel",
  }),
  Object.freeze({
    id: "tautan-sumber",
    claim: "Tautan ke halaman aslinya selalu ada, di awal dan di akhir.",
    basis:
      "Tampilan ini tidak resmi dan bisa saja tertinggal dari situs aslinya. " +
      "Pembaca harus selalu punya jalan untuk memeriksa sendiri ke sumbernya.",
    wcag: "",
    checkedBy: "tests/serializer.test.mjs, pemeriksaan tautan sumber",
  }),
]);

/** Dipakai test untuk memastikan tidak ada id kembar. */
export function guaranteeIds() {
  return READER_GUARANTEES.map((item) => item.id);
}

export function findGuarantee(id) {
  return READER_GUARANTEES.find((item) => item.id === id) || null;
}

/**
 * Bentuk yang ikut ditulis ke dalam snapshot.
 *
 * Sengaja membawa serta scope dan note, bukan hanya daftar butirnya, supaya
 * siapa pun yang membaca berkas ini tanpa membaca kode tetap tahu batasnya.
 */
export function guaranteesForSnapshot() {
  return {
    scope: GUARANTEE_SCOPE,
    note: GUARANTEE_SCOPE_NOTE,
    measured: false,
    items: READER_GUARANTEES.map((item) => ({ ...item })),
  };
}
