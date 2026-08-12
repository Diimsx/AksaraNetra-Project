/**
 * Pengisi layar hasil audit.
 *
 * Tidak ada framework dan tidak ada langkah build. Berkas ini dimuat langsung
 * oleh penjelajah sebagai modul.
 *
 * Aturan yang dipegang di sini:
 * 1. Semua teks yang berasal dari data dimasukkan lewat textContent, tidak
 *    pernah lewat innerHTML. Data ini berasal dari situs luar, jadi tidak boleh
 *    dipercaya sebagai HTML.
 * 2. Setiap angka persen selalu ditemani keterangan cakupan. Kalau keterangan
 *    itu belum ada di data, angka persennya tidak ditampilkan.
 * 3. Kegagalan selalu punya kalimat dan saran perbaikan. Halaman kosong bukan
 *    pilihan yang boleh diambil.
 */

const INDEX_URL = "data/index.json";

const elemen = {
  status: document.getElementById("status"),
  catatanCakupan: document.getElementById("catatan-cakupan"),
  daftar: document.getElementById("daftar-situs"),
  isiHasil: document.getElementById("isi-hasil"),
  pemberitahuan: document.getElementById("pemberitahuan"),
  keteranganData: document.getElementById("keterangan-data"),
  judulHasil: document.getElementById("judul-hasil"),

  // Bagian mode langsung. Elemennya selalu ada di HTML, tapi bagiannya
  // tersembunyi sampai server lokal terbukti berjalan.
  navLangsung: document.getElementById("nav-langsung"),
  bagianLangsung: document.getElementById("langsung"),
  formLangsung: document.getElementById("form-langsung"),
  isianAlamat: document.getElementById("alamat"),
  tombolAudit: document.getElementById("tombol-audit"),
  statusLangsung: document.getElementById("status-langsung"),
};

let cakupan = { rules: [], note: "" };

/**
 * Membuat satu elemen dengan teks yang sudah aman.
 */
function buat(tag, { text = "", className = "", attrs = {} } = {}) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  for (const [nama, nilai] of Object.entries(attrs)) {
    if (nilai !== null && nilai !== undefined) node.setAttribute(nama, String(nilai));
  }
  return node;
}

function kosongkan(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function umumkan(pesan, jenis = "info") {
  elemen.status.textContent = pesan;
  elemen.status.dataset.jenis = jenis;
}

/**
 * Waktu dalam bentuk yang bisa dibaca orang, tanpa menyembunyikan bahwa ini
 * hanya potret pada satu saat tertentu.
 */
function waktuTerbaca(iso) {
  if (!iso) return "waktu audit tidak tercatat";
  const tanggal = new Date(iso);
  if (Number.isNaN(tanggal.getTime())) return "waktu audit tidak tercatat";

  return tanggal.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Kalimat cakupan yang menempel pada setiap angka persen.
 *
 * Daftar rule diambil dari data, bukan ditulis di sini, supaya kalau suatu hari
 * jumlah rule bertambah kalimat ini tidak jadi bohong.
 */
function kalimatCakupan() {
  const daftar = cakupan.rules || [];
  const jumlah = daftar.length;

  if (jumlah === 0) {
    return "Angka ini hanya mencakup sebagian rule aksesibilitas, bukan seluruh WCAG.";
  }

  return `Angka ini hanya mencakup ${jumlah} rule yang diperbaiki otomatis, yaitu ${daftar.join(", ")}. Bukan seluruh WCAG.`;
}

function teksPenurunan(entri) {
  const persen = entri.reductionPercent;
  if (typeof persen !== "number") return "angka penurunan belum tersedia";

  return `turun ${persen} persen pada ${cakupan.rules.length || "beberapa"} rule yang dipantau`;
}

function gambarDaftar(index) {
  kosongkan(elemen.daftar);

  for (const entri of index.sites || []) {
    const item = document.createElement("li");
    const tombol = buat("button", {
      className: "tombol-situs",
      attrs: {
        type: "button",
        "data-id": entri.id,
        "data-status": entri.status,
        "aria-pressed": "false",
      },
    });

    tombol.appendChild(buat("span", { text: entri.name, className: "nama-situs" }));

    if (entri.status === "berhasil") {
      tombol.appendChild(
        buat("span", {
          text: `${entri.beforeTotal} masalah menjadi ${entri.afterTotal}, ${teksPenurunan(entri)}`,
          className: "angka-situs",
        }),
      );
    } else {
      tombol.appendChild(
        buat("span", {
          text: "Audit terakhir gagal. Pilih untuk melihat alasannya.",
          className: "angka-situs",
        }),
      );
    }

    tombol.addEventListener("click", () => pilihSitus(entri, tombol));
    item.appendChild(tombol);
    elemen.daftar.appendChild(item);
  }
}

function tandaiTerpilih(tombolAktif) {
  for (const tombol of elemen.daftar.querySelectorAll(".tombol-situs")) {
    tombol.setAttribute("aria-pressed", tombol === tombolAktif ? "true" : "false");
  }
}

function gambarKegagalan(entri) {
  kosongkan(elemen.isiHasil);

  const kotak = buat("div", { className: "kotak-gagal" });
  kotak.appendChild(buat("h3", { text: entri.name }));
  kotak.appendChild(
    buat("p", {
      text: entri.failure?.message || "Audit situs ini gagal tanpa keterangan.",
    }),
  );

  if (entri.failure?.stage) {
    kotak.appendChild(
      buat("p", {
        text: `Gagal pada langkah ${entri.failure.stage}, yaitu ${entri.failure.stageName || "langkah yang tidak tercatat"}.`,
        className: "catatan",
      }),
    );
  }

  // Tautan ke halaman sumber tetap ditampilkan meski audit gagal, supaya
  // pemakai masih punya jalan ke informasi aslinya.
  const tindakan = buat("div", { className: "tindakan" });
  tindakan.appendChild(
    buat("a", {
      text: `Buka halaman aslinya di ${entri.sourceUrl}`,
      className: "tautan-tombol",
      attrs: { href: entri.sourceUrl, rel: "noopener noreferrer" },
    }),
  );
  kotak.appendChild(tindakan);

  elemen.isiHasil.appendChild(kotak);
  document.body.dataset.hasil = "ya";
}

function gambarTabelRule(rules) {
  const daftarRule = Object.entries(rules || {});
  if (daftarRule.length === 0) return null;

  // Pembungkus tabel bisa digulir pada layar sempit dan pada zoom besar, jadi
  // pembungkusnya harus bisa menerima fokus keyboard dan punya nama.
  const pembungkus = buat("div", {
    className: "pembungkus-tabel",
    attrs: {
      tabindex: "0",
      role: "region",
      "aria-label": "Rincian per rule, area yang bisa digulir ke samping",
    },
  });

  const tabel = document.createElement("table");
  tabel.appendChild(
    buat("caption", { text: "Jumlah node bermasalah pada setiap rule" }),
  );

  const kepala = document.createElement("thead");
  const barisKepala = document.createElement("tr");
  barisKepala.appendChild(buat("th", { text: "Rule", attrs: { scope: "col" } }));
  for (const judul of ["Sebelum", "Sesudah", "Selisih"]) {
    barisKepala.appendChild(
      buat("th", { text: judul, className: "angka", attrs: { scope: "col" } }),
    );
  }
  kepala.appendChild(barisKepala);
  tabel.appendChild(kepala);

  const isi = document.createElement("tbody");
  for (const [namaRule, angka] of daftarRule) {
    const baris = document.createElement("tr");
    baris.appendChild(buat("th", { text: namaRule, attrs: { scope: "row" } }));

    const sebelum = angka?.before ?? 0;
    const sesudah = angka?.after ?? 0;

    baris.appendChild(buat("td", { text: String(sebelum), className: "angka" }));
    baris.appendChild(buat("td", { text: String(sesudah), className: "angka" }));
    baris.appendChild(
      buat("td", { text: String(sebelum - sesudah), className: "angka" }),
    );

    isi.appendChild(baris);
  }
  tabel.appendChild(isi);

  pembungkus.appendChild(tabel);
  return pembungkus;
}

/**
 * Pembungkus tabel yang bisa digulir dan bisa menerima fokus keyboard.
 *
 * Dipisah jadi fungsi sendiri karena sekarang ada empat tabel di layar hasil,
 * dan area gulir tanpa nama serta tanpa fokus adalah persis cacat yang alat ini
 * dibuat untuk memperbaiki. Memiliki cacat itu di UI sendiri akan memalukan.
 */
function pembungkusTabel(namaArea) {
  return buat("div", {
    className: "pembungkus-tabel",
    attrs: {
      tabindex: "0",
      role: "region",
      "aria-label": `${namaArea}, area yang bisa digulir ke samping`,
    },
  });
}

function bukaTutup(judul, terbuka = false) {
  const kotak = document.createElement("details");
  if (terbuka) kotak.open = true;
  kotak.appendChild(buat("summary", { text: judul }));
  return kotak;
}

/**
 * Bagian jaminan tampilan mudah dibaca.
 *
 * Sengaja dipisah dari tabel tiga rule, dan sengaja tanpa satu pun angka
 * persen. Dua hal ini berbeda jenisnya:
 *
 *   tabel rule -> hasil perbaikan pada halaman aslinya, diukur, bisa gagal
 *   jaminan    -> akibat dari kita membangun halamannya sendiri, tidak diukur
 *
 * Mencampur keduanya menjadi satu persentase adalah kesalahan yang paling
 * mungkin terjadi saat menulis proposal, jadi di UI pun tidak boleh berdekatan
 * tanpa penjelasan.
 */
function gambarJaminan(snapshot) {
  const jaminan = snapshot.readerGuarantees;
  if (!jaminan?.items?.length) return null;

  const bagian = buat("section", { className: "jaminan" });
  bagian.appendChild(buat("h4", { text: "Selalu benar di tampilan mudah dibaca" }));
  bagian.appendChild(buat("p", { text: jaminan.note, className: "catatan" }));
  bagian.appendChild(
    buat("p", {
      text:
        "Bagian ini tidak punya angka persen, karena isinya bukan hasil perbaikan yang diukur. " +
        "Semuanya sudah benar sejak halaman ini dibuat, dan setiap butir punya cara pemeriksaannya sendiri.",
      className: "catatan",
    }),
  );

  const daftar = buat("ul", { className: "daftar-jaminan" });

  for (const butir of jaminan.items) {
    const item = document.createElement("li");
    const kotak = bukaTutup(butir.claim);

    kotak.appendChild(buat("p", { text: butir.basis }));
    if (butir.wcag) {
      kotak.appendChild(buat("p", { text: `Acuan: ${butir.wcag}`, className: "catatan" }));
    }
    kotak.appendChild(
      buat("p", { text: `Diperiksa oleh: ${butir.checkedBy}`, className: "catatan" }),
    );

    item.appendChild(kotak);
    daftar.appendChild(item);
  }

  bagian.appendChild(daftar);
  return bagian;
}

function gambarTabelKeputusan(namaKelompok, kelompok) {
  const pembungkus = pembungkusTabel(`Daftar ${namaKelompok}`);

  const tabel = document.createElement("table");
  tabel.appendChild(buat("caption", { text: `Daftar ${namaKelompok}` }));

  const kepala = document.createElement("thead");
  const barisKepala = document.createElement("tr");
  for (const judul of ["Rule", "Elemen", "Nama yang diusulkan", "Keyakinan", "Alasan"]) {
    barisKepala.appendChild(buat("th", { text: judul, attrs: { scope: "col" } }));
  }
  kepala.appendChild(barisKepala);
  tabel.appendChild(kepala);

  const isi = document.createElement("tbody");

  for (const keputusan of kelompok.items) {
    const baris = document.createElement("tr");
    baris.appendChild(buat("th", { text: keputusan.rule, attrs: { scope: "row" } }));
    baris.appendChild(buat("td", { text: keputusan.selector || "tidak dicatat" }));

    // Tambalan yang bukan teks, misalnya tabindex pada area gulir, memang tidak
    // punya nama untuk ditampilkan. Ditulis apa adanya, bukan dikarang.
    baris.appendChild(
      buat("td", {
        text: keputusan.label || `tanpa teks, atribut ${keputusan.attributes.join(" ") || "tidak dicatat"}`,
      }),
    );

    baris.appendChild(
      buat("td", {
        text: typeof keputusan.confidence === "number" ? keputusan.confidence.toFixed(2) : "tidak dicatat",
        className: "angka",
      }),
    );
    baris.appendChild(buat("td", { text: keputusan.reason || keputusan.source || "tidak dicatat" }));

    isi.appendChild(baris);
  }

  tabel.appendChild(isi);
  pembungkus.appendChild(tabel);
  return pembungkus;
}

/**
 * Bagian keputusan satu per satu.
 *
 * Alat yang mengubah halaman orang lain harus mau menunjukkan apa saja yang
 * diubahnya. Kelompok yang kosong tetap ditampilkan, karena kosong itu juga
 * informasi: pada audit itu tidak ada kasus yang menggantung di tengah.
 */
function gambarKeputusan(snapshot) {
  const keputusan = snapshot.decisions;
  if (!keputusan) return null;

  const bagian = buat("section", { className: "keputusan" });
  bagian.appendChild(buat("h4", { text: "Keputusan satu per satu" }));
  bagian.appendChild(
    buat("p", {
      text:
        "Setiap perubahan punya nilai keyakinan. Mulai 0,80 diterapkan langsung, " +
        "antara 0,60 dan 0,79 hanya diusulkan dan perlu diperiksa orang, di bawah 0,60 dilewati. " +
        "Nama tidak pernah dikarang dari isi gambar.",
      className: "catatan",
    }),
  );

  const kelompokTampil = [
    ["perubahan yang diterapkan", keputusan.applied, true],
    ["usulan yang perlu diperiksa orang", keputusan.review, false],
    ["kasus yang dilewati", keputusan.skipped, false],
  ];

  for (const [nama, kelompok, terbuka] of kelompokTampil) {
    if (!kelompok) continue;

    const kotak = bukaTutup(`${nama.charAt(0).toUpperCase()}${nama.slice(1)}: ${kelompok.total}`, terbuka);

    if (kelompok.total === 0) {
      kotak.appendChild(
        buat("p", { text: "Tidak ada satu pun pada audit ini.", className: "catatan" }),
      );
    } else {
      kotak.appendChild(gambarTabelKeputusan(nama, kelompok));

      if (kelompok.truncated) {
        kotak.appendChild(
          buat("p", {
            text: `Hanya ${kelompok.items.length} dari ${kelompok.total} baris yang ditampilkan. Daftar lengkapnya ada di berkas engine-result.json.`,
            className: "catatan",
          }),
        );
      }
    }

    bagian.appendChild(kotak);
  }

  return bagian;
}

/**
 * Bagian riwayat.
 *
 * Ini bukan hiasan grafik. Ini yang membedakan kalimat "situs ini punya 20
 * masalah" dari kalimat "situs ini punya antara 8 dan 24 masalah tergantung
 * kapan diperiksa". Kalimat kedua yang benar, dan hanya kalimat kedua yang
 * bisa dipertahankan kalau ada yang memeriksa sendiri di hari yang lain.
 */
function gambarRiwayat(entri) {
  const riwayat = entri.stability;
  if (!riwayat) return null;

  const bagian = buat("section", { className: "riwayat" });
  bagian.appendChild(buat("h4", { text: "Riwayat audit situs ini" }));
  bagian.appendChild(buat("p", { text: riwayat.note, className: "catatan" }));

  const daftar = Array.isArray(entri.recentRuns) ? entri.recentRuns : [];
  if (daftar.length === 0) return bagian;

  const pembungkus = pembungkusTabel("Riwayat audit");
  const tabel = document.createElement("table");
  tabel.appendChild(buat("caption", { text: "Audit terakhir yang tercatat" }));

  const kepala = document.createElement("thead");
  const barisKepala = document.createElement("tr");
  barisKepala.appendChild(buat("th", { text: "Waktu audit", attrs: { scope: "col" } }));
  for (const judul of ["Sebelum", "Sesudah"]) {
    barisKepala.appendChild(
      buat("th", { text: judul, className: "angka", attrs: { scope: "col" } }),
    );
  }
  kepala.appendChild(barisKepala);
  tabel.appendChild(kepala);

  const isi = document.createElement("tbody");
  for (const catatan of daftar) {
    const baris = document.createElement("tr");
    baris.appendChild(
      buat("th", { text: waktuTerbaca(catatan.capturedAt), attrs: { scope: "row" } }),
    );
    baris.appendChild(buat("td", { text: String(catatan.beforeTotal ?? "-"), className: "angka" }));
    baris.appendChild(buat("td", { text: String(catatan.afterTotal ?? "-"), className: "angka" }));
    isi.appendChild(baris);
  }
  tabel.appendChild(isi);

  pembungkus.appendChild(tabel);
  bagian.appendChild(pembungkus);
  return bagian;
}

function gambarHasil(entri, snapshot) {
  kosongkan(elemen.isiHasil);

  const summary = snapshot.summary || {};
  const sumber = snapshot.source || {};

  elemen.isiHasil.appendChild(buat("h3", { text: entri.name }));
  elemen.isiHasil.appendChild(
    buat("p", {
      text: `Diaudit pada ${waktuTerbaca(snapshot.capturedAt)}. Ini potret pada saat itu saja, angkanya bisa berbeda esok hari.`,
      className: "catatan",
    }),
  );

  const ringkasan = buat("ul", { className: "ringkasan" });
  const angka = [
    ["Masalah sebelum", summary.beforeTotal],
    ["Masalah sesudah", summary.afterTotal],
    ["Penurunan", typeof summary.reductionPercent === "number" ? `${summary.reductionPercent} persen` : "belum tersedia"],
  ];

  for (const [label, nilai] of angka) {
    const item = document.createElement("li");
    item.appendChild(buat("span", { text: label, className: "label" }));
    item.appendChild(
      buat("span", { text: String(nilai ?? "belum tersedia"), className: "angka-besar" }),
    );
    ringkasan.appendChild(item);
  }
  elemen.isiHasil.appendChild(ringkasan);

  // Keterangan cakupan ditempel tepat di bawah angka, bukan di kaki halaman.
  elemen.isiHasil.appendChild(buat("p", { text: kalimatCakupan(), className: "catatan" }));

  // Judul bagian ditambahkan supaya tabel tiga rule tidak lagi berdiri tanpa
  // konteks. Sebelumnya orang melihat tiga baris saja dan menyimpulkan alat ini
  // hanya mengurus tiga hal, padahal tampilan mudah dibaca mengurus lebih
  // banyak. Yang kurang bukan kerjanya, melainkan laporannya.
  const tabel = gambarTabelRule(snapshot.rules);
  if (tabel) {
    elemen.isiHasil.appendChild(
      buat("h4", { text: "Diperbaiki otomatis di halaman aslinya" }),
    );
    elemen.isiHasil.appendChild(
      buat("p", {
        text:
          "Hanya tiga rule ini yang ditambal otomatis pada halaman aslinya, dan hanya ketiganya " +
          "yang dihitung ke dalam angka penurunan di atas.",
        className: "catatan",
      }),
    );
    elemen.isiHasil.appendChild(tabel);
  }

  const jaminan = gambarJaminan(snapshot);
  if (jaminan) elemen.isiHasil.appendChild(jaminan);

  const keputusan = gambarKeputusan(snapshot);
  if (keputusan) elemen.isiHasil.appendChild(keputusan);

  const riwayat = gambarRiwayat(entri);
  if (riwayat) elemen.isiHasil.appendChild(riwayat);

  const tindakan = buat("div", { className: "tindakan" });

  if (snapshot.views?.readerView) {
    tindakan.appendChild(
      buat("a", {
        text: "Buka tampilan mudah dibaca",
        className: "tautan-tombol",
        attrs: { href: `data/${entri.id}/${snapshot.views.readerView}` },
      }),
    );
  }

  const alamatSumber = sumber.requestedUrl || entri.sourceUrl;
  tindakan.appendChild(
    buat("a", {
      text: "Buka halaman aslinya",
      className: "tautan-tombol",
      attrs: { href: alamatSumber, rel: "noopener noreferrer" },
    }),
  );

  elemen.isiHasil.appendChild(tindakan);

  // Alamat sumber ditulis lengkap, bukan hanya disembunyikan di dalam tautan,
  // supaya pemakai tahu ke mana tombol itu membawanya.
  elemen.isiHasil.appendChild(
    buat("p", { text: `Alamat sumber: ${alamatSumber}`, className: "catatan" }),
  );

  if (snapshot.guard) {
    elemen.isiHasil.appendChild(
      buat("p", {
        text: `Selama audit, ${snapshot.guard.blocked ?? 0} permintaan diblokir dan ${snapshot.guard.allowed ?? 0} permintaan diizinkan.`,
        className: "catatan",
      }),
    );
  }

  document.body.dataset.hasil = "ya";
}

async function pilihSitus(entri, tombol) {
  tandaiTerpilih(tombol);

  if (entri.status !== "berhasil") {
    umumkan(`Audit ${entri.name} gagal pada percobaan terakhir.`, "gagal");
    gambarKegagalan(entri);
    return;
  }

  umumkan(`Sedang memuat hasil audit ${entri.name}.`);
  kosongkan(elemen.isiHasil);
  elemen.isiHasil.appendChild(buat("p", { text: "Sedang memuat hasil audit." }));

  try {
    const respons = await fetch(`data/${entri.id}/snapshot.json`, { cache: "no-store" });
    if (!respons.ok) throw new Error(`status ${respons.status}`);

    const snapshot = await respons.json();
    gambarHasil(entri, snapshot);
    umumkan(`Hasil audit ${entri.name} sudah tampil di bagian Hasil audit.`);
    elemen.judulHasil.focus?.();
  } catch (error) {
    umumkan(`Gagal memuat hasil audit ${entri.name}.`, "gagal");

    kosongkan(elemen.isiHasil);
    const kotak = buat("div", { className: "kotak-gagal" });
    kotak.appendChild(buat("h3", { text: "Hasil audit tidak bisa dimuat" }));
    kotak.appendChild(
      buat("p", {
        text: `Berkas data/${entri.id}/snapshot.json tidak bisa dibaca. Keterangan teknis: ${error.message}.`,
      }),
    );
    kotak.appendChild(
      buat("p", {
        text: "Saran: jalankan npm run build:data untuk membuat ulang berkas hasil, lalu muat ulang halaman ini.",
      }),
    );
    elemen.isiHasil.appendChild(kotak);
  }
}

function tampilkanGagalTotal(error) {
  umumkan("Data hasil audit tidak bisa dimuat.", "gagal");

  kosongkan(elemen.daftar);
  kosongkan(elemen.isiHasil);

  const kotak = buat("div", { className: "kotak-gagal" });
  kotak.appendChild(buat("h3", { text: "Daftar situs tidak bisa dimuat" }));
  kotak.appendChild(
    buat("p", {
      text: `Berkas ${INDEX_URL} tidak terbaca. Keterangan teknis: ${error.message}.`,
    }),
  );

  const saran = document.createElement("ul");
  for (const langkah of [
    "Jalankan npm run build:data supaya berkas hasil audit dibuat.",
    "Pastikan halaman ini dibuka lewat server statis, bukan lewat klik ganda di penjelajah berkas.",
    "Periksa apakah folder ui/data benar benar ada.",
  ]) {
    saran.appendChild(buat("li", { text: langkah }));
  }
  kotak.appendChild(saran);

  elemen.isiHasil.appendChild(kotak);

  elemen.pemberitahuan.textContent =
    "Teks pemberitahuan diambil dari hasil audit, dan hasil audit belum bisa dibaca.";
}

async function mulai() {
  umumkan("Sedang memuat daftar situs.");

  try {
    const respons = await fetch(INDEX_URL, { cache: "no-store" });
    if (!respons.ok) throw new Error(`status ${respons.status}`);

    const index = await respons.json();
    cakupan = index.scope || cakupan;

    elemen.catatanCakupan.textContent = `${cakupan.note || ""} ${kalimatCakupan()}`.trim();

    // Teks pemberitahuan wajib berasal dari data, tidak boleh ditulis di HTML.
    elemen.pemberitahuan.textContent =
      index.disclaimer || "Teks pemberitahuan tidak ditemukan di dalam data hasil audit.";

    elemen.keteranganData.textContent = `Data dibuat pada ${waktuTerbaca(index.generatedAt)} memakai Aksara Netra versi ${index.engineVersion || "tidak tercatat"}.`;

    gambarDaftar(index);

    const jumlah = (index.sites || []).length;
    const berhasil = index.counts?.succeeded ?? 0;
    umumkan(
      jumlah === 0
        ? "Belum ada situs di dalam data hasil audit."
        : `${jumlah} situs siap dilihat, ${berhasil} di antaranya berhasil diaudit. Pilih satu situs untuk melihat rinciannya.`,
    );
  } catch (error) {
    tampilkanGagalTotal(error);
  } finally {
    // Penanda untuk scripts/test-ui.mjs. Menandai bahwa halaman sudah selesai
    // menggambar, baik berhasil maupun gagal.
    document.body.dataset.siap = "ya";
  }
}

/*
 * Mode langsung.
 *
 * Alat ini punya dua cara pakai. Kalau halaman dibuka dari hosting statis, yang
 * ada hanya katalog hasil audit yang dibuat lebih dulu oleh build:data. Kalau
 * halaman dibuka lewat npm run serve, ada server lokal yang bisa menjalankan
 * Chromium, jadi pemakai boleh mengetik alamat sendiri.
 *
 * UI tidak boleh menebak mode mana yang sedang berjalan. Ia menanyakannya ke
 * api/status. Kalau pertanyaan itu gagal, itu bukan error, itu jawaban: berarti
 * tidak ada server lokal, dan form alamat memang tidak boleh ditampilkan.
 */
const STATUS_URL = "api/status";
const AUDIT_URL = "api/audit";

function umumkanLangsung(pesan, jenis = "info") {
  elemen.statusLangsung.textContent = pesan;
  elemen.statusLangsung.dataset.jenis = jenis;
}

/**
 * Kotak kegagalan untuk audit yang diminta lewat form.
 *
 * Dibuat terpisah dari gambarKegagalan, karena di sini alamat yang diketik bisa
 * saja bukan alamat yang sah. Menawarkan tombol "buka halaman aslinya" untuk teks
 * yang bukan alamat hanya akan membingungkan.
 */
function gambarGagalManual(alamat, hasil) {
  kosongkan(elemen.isiHasil);

  const kotak = buat("div", { className: "kotak-gagal" });
  kotak.appendChild(buat("h3", { text: "Audit tidak bisa diselesaikan" }));
  kotak.appendChild(buat("p", { text: hasil.message || "Audit gagal tanpa keterangan." }));

  if (hasil.stage) {
    kotak.appendChild(
      buat("p", {
        text: `Gagal pada langkah ${hasil.stage}, yaitu ${hasil.stageName || "langkah yang tidak tercatat"}.`,
        className: "catatan",
      }),
    );
  }

  kotak.appendChild(buat("p", { text: `Alamat yang diminta: ${alamat}`, className: "catatan" }));

  // Tautan hanya ditawarkan kalau alamatnya memang berbentuk alamat web.
  if (/^https?:\/\//i.test(alamat)) {
    const tindakan = buat("div", { className: "tindakan" });
    tindakan.appendChild(
      buat("a", {
        text: "Buka halaman aslinya",
        className: "tautan-tombol",
        attrs: { href: alamat, rel: "noopener noreferrer" },
      }),
    );
    kotak.appendChild(tindakan);
  }

  elemen.isiHasil.appendChild(kotak);
  document.body.dataset.hasil = "ya";
}

async function jalankanAuditManual(alamat) {
  // Tombol dimatikan selama menunggu. Server hanya melayani satu audit sekaligus,
  // jadi klik kedua tidak mempercepat apa pun.
  elemen.tombolAudit.disabled = true;
  elemen.tombolAudit.textContent = "Sedang mengaudit";

  umumkanLangsung(
    `Sedang mengaudit ${alamat}. Ini biasanya butuh 30 sampai 90 detik. Jangan tutup halaman ini.`,
  );

  kosongkan(elemen.isiHasil);
  elemen.isiHasil.appendChild(
    buat("p", {
      text: `Sedang mengaudit ${alamat}. Hasilnya akan muncul di bagian ini setelah selesai.`,
    }),
  );

  try {
    const respons = await fetch(AUDIT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: alamat }),
    });

    const hasil = await respons.json();

    if (!hasil.ok) {
      umumkanLangsung(`Audit ${alamat} gagal. Alasannya ada di bagian Hasil audit.`, "gagal");
      gambarGagalManual(alamat, hasil);
      elemen.judulHasil.focus?.();
      return;
    }

    const sumber = hasil.snapshot.source || {};
    const entri = {
      id: hasil.id,
      // Judul halaman dipakai kalau ada, karena lebih mudah dikenali daripada
      // alamat panjang. Kalau tidak ada, alamatnya yang dipakai apa adanya.
      name: sumber.title || alamat,
      sourceUrl: sumber.requestedUrl || alamat,
    };

    gambarHasil(entri, hasil.snapshot);
    umumkanLangsung(`Audit ${alamat} selesai. Hasilnya tampil di bagian Hasil audit.`);
    elemen.judulHasil.focus?.();
  } catch (error) {
    umumkanLangsung("Audit gagal dikirim ke server lokal.", "gagal");

    gambarGagalManual(alamat, {
      message:
        "Permintaan tidak sampai ke server lokal. Kemungkinan besar server sudah berhenti berjalan.",
      stage: 0,
      stageName: "mengirim permintaan ke server lokal",
    });

    elemen.isiHasil.appendChild(
      buat("p", {
        text: `Saran: jalankan npm run serve lagi di terminal, lalu muat ulang halaman ini. Keterangan teknis: ${error.message}.`,
        className: "catatan",
      }),
    );
  } finally {
    elemen.tombolAudit.disabled = false;
    elemen.tombolAudit.textContent = "Audit alamat ini";
  }
}

async function siapkanModeLangsung() {
  let status = null;

  try {
    const respons = await fetch(STATUS_URL, { cache: "no-store" });
    if (!respons.ok) throw new Error(`status ${respons.status}`);
    status = await respons.json();
  } catch {
    // Tidak ada server lokal. Ini keadaan yang normal, bukan kesalahan, jadi
    // tidak ada pesan error yang perlu ditampilkan.
    return;
  }

  if (!status || status.mode !== "langsung") return;

  elemen.bagianLangsung.hidden = false;
  elemen.navLangsung.hidden = false;

  const jeda = Number(status.minIntervalMs);
  umumkanLangsung(
    Number.isFinite(jeda) && jeda > 0
      ? `Server lokal siap. Audit ke situs yang sama diberi jeda minimal ${jeda / 1000} detik, jadi kadang tombolnya terasa lambat merespons.`
      : "Server lokal siap. Masukkan alamat halaman publik yang mau diaudit.",
  );

  elemen.formLangsung.addEventListener("submit", (peristiwa) => {
    // Pengiriman bawaan penjelajah akan memuat ulang halaman dan membuang hasil
    // yang sudah tampil.
    peristiwa.preventDefault();

    if (elemen.tombolAudit.disabled) return;

    const alamat = elemen.isianAlamat.value.trim();

    if (!alamat) {
      umumkanLangsung("Alamat masih kosong. Isi dulu alamat halamannya.", "gagal");
      elemen.isianAlamat.focus();
      return;
    }

    jalankanAuditManual(alamat);
  });
}

await mulai();

// Mode langsung diperiksa setelah katalog selesai digambar, supaya kegagalan
// mendeteksi server tidak pernah menghalangi bagian yang sudah pasti bisa jalan.
await siapkanModeLangsung();
