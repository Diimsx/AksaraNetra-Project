# Panduan Pakai Aksara Netra

Ditujukan untuk orang yang baru pertama kali membuka repo ini. Ikuti dari atas ke
bawah, jangan melompat.

## 1. Apa ini

Aksara Netra membuka satu halaman informasi publik atas permintaan pemakai,
memeriksa aksesibilitasnya dengan axe-core, lalu memperbaiki tiga jenis masalah
yang bisa diperbaiki dengan aman dan menyajikan hasilnya sebagai tampilan yang
mudah dibaca. Setiap audit menghasilkan laporan sebelum dan sesudah beserta
seluruh bahan buktinya, jadi angkanya bisa diperiksa ulang oleh orang lain.

Yang alat ini TIDAK lakukan: alat ini tidak mengubah website aslinya sama
sekali, tidak menjelajah situs secara otomatis, tidak menyentuh halaman yang
perlu login, dan tidak mengarang teks alt untuk gambar.

## 2. Prasyarat

- Node versi 24 atau lebih baru. Periksa dengan `node --version`.
- Git, untuk mengambil dan mengirim kode.
- Koneksi internet, karena audit membuka situs sungguhan.

Catatan untuk Windows: pakai **Git Bash**, jangan PowerShell. Perintah di panduan
ini memakai cara Bash untuk menyetel variabel lingkungan, misalnya
`TARGET_URL=... npm run test:engine`. PowerShell tidak mengerti bentuk itu dan
akan gagal dengan pesan yang membingungkan. Kalau memang harus memakai
PowerShell, setel variabelnya lebih dulu dengan `$env:TARGET_URL="..."` di baris
terpisah.

## 3. Instalasi

```bash
npm install
npx playwright install chromium
```

Langkah kedua tidak boleh dilewati. `npm install` hanya mengunduh paket
`playwright`, dan paket itu isinya kode pengendali browser, bukan browsernya.
Browser Chromium diunduh terpisah ke folder cache di komputer, sekitar 130 MB.
Kalau langkah ini dilewati, `npm test` masih bisa hijau sebagian, tetapi
`npm run test:engine` akan gagal dengan pesan `Executable doesn't exist`.

## 4. Empat perintah utama

### npm test

Menjalankan seluruh unit test. Ini yang paling sering dipakai, dan yang paling
cepat memberi tahu kalau ada yang rusak.

Contoh keluaran nyata dari suite yang tidak butuh browser:

```
ℹ tests 65
ℹ suites 0
ℹ pass 65
ℹ fail 0
ℹ duration_ms 296.766715
```

Cara membacanya: yang penting hanya `fail`. Angka `fail 0` berarti aman. Kalau
`fail` lebih dari nol, jangan lanjut mengerjakan apa pun sebelum itu beres.
Satu berkas test, `tests/engine.test.mjs`, membuka Chromium sungguhan, jadi
total test di komputer yang sudah memasang Chromium akan lebih besar daripada 65
dan durasinya beberapa detik, bukan ratusan milidetik.

Kalau ingin cepat dan hanya butuh test yang murni, pakai `npm run test:fast`.

### npm run test:engine

Mengaudit satu halaman sungguhan dan menulis seluruh hasilnya ke folder.

```bash
npm run test:engine
TARGET_URL="https://kepriprov.go.id" OUTPUT_DIR="output-kepri" npm run test:engine
```

Contoh potongan hasil nyata dari `output/snapshot.json`:

```json
"summary": {
  "beforeTotal": 20,
  "afterTotal": 2,
  "reduction": 18,
  "reductionPercent": 90,
  "strictImprovement": true,
  "noRegression": true
}
```

Cara membacanya:

- `beforeTotal` dan `afterTotal` adalah jumlah node bermasalah pada tiga rule
  yang dipantau, bukan jumlah semua masalah di halaman itu.
- `strictImprovement` bernilai true berarti angka sesudah benar benar lebih kecil
  daripada angka sebelum. Kalau false, patch tidak memperbaiki apa pun.
- `noRegression` bernilai true berarti tidak ada rule lain yang jadi lebih buruk.
  Kalau false, patch harus diperiksa, bukan dirayakan.
- Field `guard` berisi jumlah permintaan yang diizinkan dan diblokir selama
  audit. Angka blocked yang besar itu normal, karena semua script diblokir.

### npm run build:data

Mengaudit semua situs katalog berstatus verified, lalu menulis hasilnya ke
`ui/data` supaya UI bisa dibuka tanpa menjalankan audit lagi.

```bash
npm run build:data
```

Bentuk keluaran di layar:

```
Aksara Netra <nomor versi dari package.json>
Akan mengaudit 2 situs berstatus verified.

[1/2] Pemerintah Provinsi Sulawesi Selatan
  alamat: https://sulselprov.go.id
  berhasil: 20 masalah menjadi 2 (turun 90 persen)
  permintaan diblokir guard: 41
  waktu: 38.4 detik

Ringkasan
  berhasil : 2
  gagal    : 0
  ditulis  : ui/data/index.json
```

Cara membacanya: satu situs yang gagal tidak menghentikan yang lain. Kegagalannya
dicatat di `ui/data/index.json` beserta nomor langkah yang gagal, dan proses
lanjut ke situs berikutnya. Perintah ini baru dianggap gagal kalau tidak ada satu
pun situs yang berhasil, karena itu tanda masalahnya ada di alat atau di koneksi,
bukan di situs tujuan.

Angka pada contoh di atas berasal dari audit nyata yang pernah dijalankan, tetapi
susunan barisnya belum diverifikasi baris per baris di mesin mana pun. Jalankan
sendiri dan bandingkan.

### npm run test:ui

Menjalankan axe pada UI milik kita sendiri. Alat aksesibilitas yang tidak
aksesibel tidak layak dipakai sebagai bukti apa pun.

```bash
npm run test:ui
```

Bentuk keluaran:

```
Menguji UI di /path/ke/repo/ui
Data hasil audit ditemukan, jadi keadaan berisi data yang diuji.

  keadaan awal: nol violation
  setelah satu situs dipilih: nol violation
  layar sempit, mendekati zoom 200 persen: nol violation

Total violation: 0
```

Cara membacanya: satu violation pun membuat perintah ini gagal, tidak ada batas
toleransi. Kalau ada violation, keluarannya menyebut id rule dan selector node
yang bermasalah, jadi bisa langsung dicari di `ui/index.html` atau `ui/app.mjs`.
Jalankan `npm run build:data` lebih dulu, supaya yang diuji adalah keadaan berisi
data, bukan keadaan gagal memuat.

## 5. Cara membuka UI

UI ada di folder `ui`. Jalankan server statis dari dalam folder itu:

```bash
cd ui
python3 -m http.server 8000
```

Lalu buka `http://127.0.0.1:8000` di penjelajah. Kalau tidak ada Python, pakai
`npx serve ui` dari akar repo.

UI ini tidak bisa dibuka dengan klik ganda pada `index.html` dari penjelajah
berkas. Alasannya: `app.mjs` adalah modul JavaScript dan ia memuat data dengan
`fetch`. Kalau halaman dibuka lewat alamat `file://`, penjelajah menganggap
setiap berkas berasal dari asal yang berbeda dan memblokir keduanya. Yang terlihat
adalah halaman dengan pesan gagal memuat, padahal berkas datanya ada. Server
statis membuat semua berkas punya satu asal yang sama, dan masalahnya hilang.

## 6. Cara menambah situs baru ke katalog

Semua situs hanya terdaftar di satu tempat, yaitu `src/config/catalog.mjs`.
Jangan menulis daftar situs di berkas lain.

Tambahkan satu entri seperti ini:

```js
Object.freeze({
  id: "namaprov",
  name: "Pemerintah Provinsi Nama",
  shortName: "Prov. Nama",
  host: "namaprov.go.id",
  url: "https://namaprov.go.id",
  status: "candidate",
  baselineRuns: 0,
  lastVerifiedOn: null,
  note: "Alasan situs ini dipilih.",
}),
```

Situs baru selalu dimulai dari `status: "candidate"`, dan hanya boleh naik ke
`verified` setelah diaudit tiga kali pada hari yang berbeda dengan hasil yang
mirip. Ini bukan birokrasi. Dua kejadian nyata yang jadi alasannya:

- Satu situs provinsi memberi 19 node bermasalah, lalu 1 node keesokan harinya.
- Situs provinsi lain memberi 0 node, lalu 24 node sehari kemudian.

Kedua situs itu sekarang ada di daftar `EXCLUDED_SITES` beserta tanggal
pengamatannya. Kalau satu audit dipakai sebagai dasar klaim, klaim itu bisa
runtuh hanya karena situsnya sedang mengganti tema. Naikkan `baselineRuns` setiap
kali audit ulang dilakukan, dan isi `lastVerifiedOn` dengan tanggalnya.

Situs berstatus `candidate` tidak ikut diaudit oleh `npm run build:data`, jadi
tidak akan muncul di UI sampai statusnya naik.

## 7. Arti berkas di dalam folder output

| Berkas | Isinya |
| --- | --- |
| `snapshot.json` | Ringkasan resmi. Ini yang dibaca UI. Kalau hanya boleh menyimpan satu berkas, simpan yang ini |
| `engine-result.json` | Laporan lengkap engine, termasuk setiap node yang diperbaiki, ditinjau, dan dilewati beserta alasan dan angka confidence |
| `reader.html` | Tampilan mudah dibaca. Tanpa script, tanpa penangan kejadian, kontras dan urutan judul sudah dibetulkan |
| `patched.html` | Halaman asli beserta patch, untuk membandingkan tampilannya |
| `axe-before.json` | Hasil axe untuk tiga rule target sebelum patch |
| `axe-after.json` | Hasil axe untuk tiga rule target sesudah patch |
| `axe-wcag-scan.json` | Pemindaian luas sebelum patch. Dipakai sebagai konteks halaman |
| `axe-wcag-scan-after.json` | Pemindaian luas sesudah patch. Ini yang membuktikan tidak ada rule lain yang jadi lebih buruk |
| `aria-after.yml` | Pohon aksesibilitas sesudah patch, mendekati apa yang dibacakan pembaca layar |
| `after.png` | Tangkapan layar sesudah patch |

## 8. Masalah yang sering muncul

**`Executable doesn't exist` saat `npm run test:engine`**
Chromium belum diunduh. Jalankan `npx playwright install chromium`. Ini masalah
paling sering pada komputer baru.

**Perintah dengan variabel di depan gagal di Windows**
Bentuk `TARGET_URL="..." npm run test:engine` hanya jalan di Bash. Pakai Git Bash.
Di PowerShell, setel dengan `$env:TARGET_URL="..."` pada baris terpisah lebih
dulu.

**UI menampilkan pesan gagal memuat padahal `ui/data` ada**
Halaman dibuka lewat `file://`. Jalankan server statis seperti di bagian 5.

**`npm run build:data` berhenti dengan pesan robots.txt tidak bisa dibaca**
Itu bukan bug. Kalau server membalas 500 atau 403 untuk `robots.txt`, aturannya
tidak jelas, dan alat memilih berhenti daripada menebak. Coba lagi nanti. Kalau
server membalas 404, artinya berkasnya tidak ada, dan itu berarti boleh lanjut.

**Angka hasil audit berbeda dari hari sebelumnya**
Ini wajar dan bukan tanda alat rusak. Situs berubah, konten yang dimuat berbeda,
dan carousel bisa berhenti di posisi lain. Karena itu satu situs butuh tiga kali
audit sebelum angkanya dipakai untuk klaim apa pun.

**Audit satu halaman terasa lama, sekitar setengah menit atau lebih**
Itu memang disengaja. Alat menunggu halaman tenang, lalu menggulir sampai bawah,
karena banyak konten baru dimuat saat digulir. Tanpa menunggu, audit hanya
melihat sebagian halaman dan angkanya menyesatkan.

**Sebagian judul di `reader.html` tidak bisa diklik**
Itu pilihan yang disengaja. Kalau sebuah judul tidak punya tautan sendiri, alat
hanya meminjam tautan dari kartu di sekitarnya bila di kartu itu tepat ada satu
tujuan yang jelas. Kalau kandidatnya lebih dari satu, judulnya dibiarkan jadi
teks biasa. Menebak tujuan tautan lebih berbahaya daripada tidak menautkan.

## 9. Batasan yang harus dijelaskan ke siapa pun yang bertanya

Bagian ini wajib dibaca sebelum menjelaskan alat ini kepada dosen, juri, atau
siapa pun. Melebihkan hasil akan lebih merugikan daripada mengakui batasannya.

- **Hanya tiga jenis masalah yang diperbaiki otomatis**, yaitu `link-name`,
  `button-name`, dan `scrollable-region-focusable`. Ini bukan seluruh WCAG.
  Masalah kontras dan gambar tanpa alt di halaman aslinya tidak disentuh.
- **Satu kali audit hanya potret sesaat.** Angkanya bisa berbeda esok hari, dan
  itu sudah pernah terjadi pada situs yang kami amati. Jangan menyebut satu angka
  sebagai sifat permanen sebuah situs.
- **Perbaikan kontras dan hierarki heading hanya berlaku di tampilan mudah
  dibaca**, bukan di halaman aslinya. Di tampilan itu kontras memang benar,
  karena warnanya kami tentukan sendiri dari awal, bukan karena kami memperbaiki
  warna situs.
- **Website asli tidak diubah sama sekali.** Alat ini hanya membaca halaman lalu
  menyusun tampilan lain. Tidak ada perubahan yang dikirim ke server situs.
- **Belum ada pengujian dengan pengguna tunanetra sungguhan.** Jangan pernah
  mengklaim kompatibilitas penuh dengan NVDA, JAWS, TalkBack, atau pembaca layar
  mana pun. Yang bisa dikatakan hanya bahwa hasilnya lolos pemeriksaan axe-core
  dan sudah dicoba dengan navigasi keyboard.
- **Nol violation tidak sama dengan aksesibel.** axe-core hanya menangkap masalah
  yang bisa dideteksi mesin. Banyak masalah aksesibilitas hanya terlihat kalau
  ada orang yang benar benar mencoba memakainya.

---

## Lampiran A. Mode langsung, mengaudit alamat yang diketik sendiri

### Kenapa ini butuh perintah terminal

Audit membutuhkan Chromium yang benar benar berjalan dan membuka halamannya. Hosting statis seperti GitHub Pages atau Vercel tidak bisa menjalankan browser. Jadi di hosting statis, UI hanya bisa menampilkan hasil yang sudah dibuat lebih dulu oleh `npm run build:data`.

Mode langsung menutup lubang itu di komputer sendiri. UI yang dipakai tetap UI yang sama, hanya saja ada server lokal yang menjalankan audit.

### Cara memakai

```
npm run serve
```

Bentuk keluaran di layar:

```
Aksara Netra versi <nomor versi dari package.json>, mode langsung.
Buka di penjelajah: http://127.0.0.1:4173/

Katalog hasil audit ditemukan, jadi daftar situs akan langsung terisi.
Jeda antar audit ke host yang sama minimal 5 detik. Permintaan tidak ditolak, hanya menunggu.
Satu audit berjalan sekitar 30 sampai 90 detik. Tekan Ctrl lalu C untuk berhenti.
```

Buka alamat itu di penjelajah. Bagian "Audit alamat baru" akan muncul di paling atas. Isi alamatnya, tekan tombol, lalu tunggu.

Kalau port 4173 sudah dipakai proses lain, pakai port lain:

```
PORT=4174 npm run serve
```

### Kenapa form itu tidak muncul di situs yang di-deploy

UI menanyakan lebih dulu ke `api/status` apakah ada server lokal. Kalau pertanyaan itu gagal, bagian form tetap tersembunyi. Ini disengaja: form yang terlihat tapi selalu gagal lebih buruk daripada form yang tidak ada.

Jadi hasilnya:

- dibuka lewat `npm run serve`: katalog dan form alamat
- dibuka dari hosting statis: hanya katalog

### Batas yang sengaja dipasang di server ini

- Server hanya mendengarkan di `127.0.0.1`. Jangan pernah menggantinya ke `0.0.0.0`. Siapa pun yang bisa mengirim permintaan ke server ini bisa menyuruh komputer ini membuka alamat pilihannya.
- Satu audit pada satu waktu. Setiap audit membuka satu Chromium, jadi menekan tombol berkali kali hanya memperlambat semuanya. Permintaan kedua ditolak dengan pesan yang jelas.
- Jeda minimal 5 detik ke host yang sama. Ini menunggu, bukan menolak.
- Isi permintaan dibatasi 4 KB. Sebuah alamat tidak pernah sepanjang itu.
- Hasil audit manual ditulis ke `ui/data/manual-<nama-host>/`. Mengaudit alamat yang sama dua kali akan menimpa hasil sebelumnya.

### Masalah yang mungkin muncul

- **Bagian form tidak muncul.** Halaman dibuka lewat klik ganda berkas, atau lewat server statis lain, bukan lewat `npm run serve`. Periksa alamat di bilah alamat, harus `127.0.0.1` dengan port dari `npm run serve`.
- **Tombol berubah jadi "Sedang mengaudit" lalu lama sekali.** Ini normal. Satu audit memang 30 sampai 90 detik, karena halamannya benar benar dibuka, digulir, lalu diperiksa dua kali.
- **Pesan "Masih ada satu audit yang sedang berjalan".** Tunggu yang pertama selesai.
- **Pesan gagal pada langkah 3.** `robots.txt` situs itu tidak bisa dibaca atau melarang. Alat ini berhenti, bukan menerobos.
- **Pesan gagal pada langkah 7 dengan kode `status-not-ok`.** Situsnya menjawab dengan status di luar 2xx. Ini bukan audit yang selesai, jadi tidak dihitung.
- **Situs yang mengalihkan alamat gagal diaudit.** Guard hanya mengizinkan satu alamat dokumen. Ini batas yang diketahui, bukan kejutan.

### Yang belum diverifikasi

Contoh keluaran di lampiran ini adalah bentuk keluaran yang dirancang, bukan hasil tempel dari run yang sudah dijalankan. Perintah `npm run serve` belum pernah dijalankan pada saat lampiran ini ditulis. Kalau keluarannya berbeda, yang benar adalah yang di layar.

## Lampiran B. Yang baru di versi 0.3.0

Versi ini tidak menambah satu pun rule perbaikan otomatis. Yang ditambah adalah
laporannya. Masalah yang diperbaiki: kerja tampilan mudah dibaca tidak pernah
terlihat di UI, sehingga alat ini tampak hanya mengurus tiga hal.

### Perintah baru

```
npm run test:reader
```

Menjalankan axe pada `reader.html` yang benar benar dihasilkan, bukan pada
fixture. Jalankan setelah `npm run build:data` atau `npm run test:engine`, karena
perintah ini mencari berkas hasil di `ui/data/*/reader.html` dan `output*/reader.html`.

Untuk menguji satu berkas tertentu:

```
READER_FILE=output/reader.html npm run test:reader
```

Yang diperiksa: tidak ada script, tidak ada atribut penangan kejadian, tidak ada
tautan `javascript:`, tepat satu `h1`, tidak ada judul kembar, kontras AAA,
penanda wilayah, dan tidak ada gulir mendatar pada lebar 320 piksel.

Satu temuan membuat perintah ini gagal. Berbeda dari mengaudit situs orang lain,
di sini tidak ada alasan "situsnya memang begitu". Semua isi berkas itu dibuat
oleh kode kita.

### Dua bagian di layar hasil

Layar hasil sekarang memisahkan dua hal yang dulu tercampur:

1. **Diperbaiki otomatis di halaman aslinya.** Tiga rule, diukur sebelum dan
   sesudah, punya angka persen. Ini yang bisa gagal.
2. **Selalu benar di tampilan mudah dibaca.** Dua belas jaminan, tanpa angka
   persen, karena tidak ada keadaan "sebelum" untuk dibandingkan. Setiap butir
   menyebutkan cara memeriksanya.

Jangan menjumlahkan keduanya menjadi satu persentase. Itu kesalahan yang paling
mungkin terjadi saat menulis proposal.

### Daftar keputusan

Layar hasil menampilkan setiap perubahan satu per satu: rule, elemen, nama yang
diusulkan, nilai keyakinan, dan alasannya. Terbagi tiga: diterapkan, perlu
diperiksa orang, dan dilewati.

Kelompok "perlu diperiksa orang" sering kosong, dan itu bukan kerusakan. Pada
audit Sulsel yang nyata, hasilnya 18 diterapkan, 0 perlu diperiksa, 2 dilewati.

### Riwayat audit

Berkas baru `ui/data/history.json`, hanya menambah, maksimal 30 entri per situs.

Gunanya bukan grafik. Ini yang membedakan kalimat "situs ini punya 20 masalah"
dari kalimat "situs ini punya antara 8 dan 24 masalah tergantung kapan diperiksa".
Kalimat kedua yang benar, dan hanya kalimat kedua yang bisa dipertahankan kalau
juri memeriksa sendiri di hari yang lain.

Sebuah situs baru disebut stabil setelah tiga audit di hari berbeda menghasilkan
angka yang sama. Dua audit yang sama belum cukup, karena Jogja pernah terlihat
konsisten pada dua audit lalu berubah pada audit ketiga.

### Situs candidate ikut diaudit

`npm run build:data` sekarang juga mengaudit Bengkulu dan Lampung yang masih
berstatus candidate. Hasilnya dicatat ke riwayat, tetapi statusnya tetap
candidate sampai ada tiga baseline. Untuk melewatinya:

```
SKIP_CANDIDATES=1 npm run build:data
```

### Urutan keyboard diperiksa program

`npm run test:ui` sekarang menekan Tab sendiri, mencetak urutannya, lalu gagal
kalau perhentian pertama bukan tautan lewati, atau ada elemen yang bisa difokus
tetapi tidak terlihat, atau ada elemen tanpa nama yang bisa dibacakan.

Sebelumnya urutan ini hanya ditulis di laporan. Kalimat di dokumen tidak menjaga
apa pun.

### Workflow harian menulis ke repo

`.github/workflows/audit.yml` sekarang butuh izin `contents: write` dan melakukan
commit ke `ui/data`. Ini perlu karena artifact tidak ikut masuk ke ruang kerja
run berikutnya, jadi tanpa commit, riwayat akan selalu mulai dari kosong dan
menimpa dirinya sendiri setiap hari.

### Pengujian manual

Berkas baru `PENGUJIAN-MANUAL.md`, berisi lembar kerja NVDA yang bisa diisi orang
lain. Sampai lembar itu terisi, kami belum boleh menulis "diuji dengan NVDA" di
proposal.

## Lampiran C. Yang masih belum diverifikasi

Ditulis terbuka supaya tidak ada yang mengira sudah beres:

- `npm run test:reader` belum pernah dijalankan pada komputer mana pun. Sandbox
  tempat kode ini disusun tidak punya Chromium dan tidak punya jaringan.
- `npm run serve` sudah dijalankan dan berhasil, tetapi belum ada test otomatis
  untuk `scripts/serve.mjs`.
- Angka Sulsel 20 menjadi 2 berasal dari run **tanpa** pencegat jaringan.
  `build:data` dan mode langsung memakai pencegat, yang memblokir script sehingga
  isi yang dimuat lewat XHR tidak ikut tampil. Dua sumber angka ini tidak boleh
  dicampur di dalam satu tabel proposal.
- Kepri masih 2 baseline, bukan 3. Angka 100 persen belum boleh dipakai sebagai
  klaim utama.
- Bengkulu dan Lampung masih 0 baseline.
- Situs yang melakukan redirect masih gagal diaudit. Catatan rencananya ada di
  docblock `src/guard/index.mjs`, belum dikerjakan.
- `src/shared/text.mjs` tidak diimpor berkas mana pun. Kode mati.
