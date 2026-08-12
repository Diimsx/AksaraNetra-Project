# Project A Remediation Engine, Tahap 2

Engine deterministik untuk memperbaiki tiga masalah aksesibilitas yang dilaporkan axe-core:

- `link-name`
- `button-name`
- `scrollable-region-focusable`

Engine hanya memproses node yang benar-benar dilaporkan axe. Confidence tinggi diterapkan otomatis, confidence sedang masuk review, confidence rendah dilewati. Engine tidak pernah mengarang nama.

Versi engine saat ini: **0.1.3**.

## Instalasi

```bash
npm install
npx playwright install chromium
```

## Menjalankan unit test

```bash
npm test
```

## Menguji situs live

Default target adalah `https://sulselprov.go.id`.

```bash
npm run test:engine
```

Menguji URL lain, Git Bash atau Linux atau macOS:

```bash
TARGET_URL="https://kepriprov.go.id" npm run test:engine
```

PowerShell:

```powershell
$env:TARGET_URL="https://kepriprov.go.id"
npm run test:engine
Remove-Item Env:TARGET_URL
```

Menyimpan hasil ke folder lain supaya tidak menimpa hasil sebelumnya:

```bash
OUTPUT_DIR="output-kepri" TARGET_URL="https://kepriprov.go.id" npm run test:engine
```

## Mode browser terlihat untuk NVDA

```bash
MANUAL=1 npm run test:engine
```

Browser tetap terbuka 10 menit supaya bisa ditelusuri dengan screen reader.

## Isi folder output

| File | Isi |
| --- | --- |
| `engine-result.json` | Laporan utama: metrics, targets, fixed, review, skipped, regression, peringatan |
| `axe-before.json` | Baseline **tiga rule target** sebelum patch |
| `axe-after.json` | Hasil **tiga rule target** setelah patch |
| `axe-wcag-scan.json` | Pemindaian luas WCAG sebelum patch |
| `axe-wcag-scan-after.json` | Pemindaian luas WCAG setelah patch |
| `aria-after.yml` | Snapshot pohon aksesibilitas setelah patch |
| `after.png` | Tangkapan layar penuh setelah patch |

`axe-before.json` dan `axe-after.json` memakai cakupan rule yang sama, jadi bisa dibandingkan langsung. Begitu juga dua file `axe-wcag-scan*`. Jangan membandingkan file dari cakupan yang berbeda.

## Site config

Core engine dan rule resolver tidak mengenal nama situs mana pun. Semua hal khusus per situs ada di `src/config/sites.mjs`. Ada unit test yang gagal kalau nama situs bocor ke `src/rules` atau `src/engine`.

```javascript
import { getSiteConfig } from "./src/config/sites.mjs";

const config = getSiteConfig("https://sulselprov.go.id");
```

Field yang tersedia:

- `siteLabel`, ditempel di belakang label link sosial, contoh "Buka Instagram Sulselprov"
- `knownLinkLabels`, peta pathname atau href ke label yang sudah diverifikasi manusia
- `buttonLabels`, override label tombol generik untuk kunci `next`, `previous`, `close`, `search`, `menu`
- `mediaButtonLabels`, override label tombol dalam konteks carousel
- `verifiedLabels`, label yang dikunci manusia per selector

Situs yang belum terdaftar tetap bisa diproses. Engine hanya berjalan tanpa label khusus, dan `test:engine` mencetak catatan bahwa situs tersebut belum terdaftar.

## Label yang dikunci manusia

Kadang engine sudah bekerja persis sesuai aturan, tetapi hasilnya tetap keliru karena markup situs aslinya menyesatkan.

Contoh nyata di Sulsel. Ada area gulir berisi daftar Peraturan Gubernur, tetapi heading yang mendahuluinya di DOM berbunyi "Opini". Engine mengambil "Opini" karena itu memang aturannya. Manusia yang membaca DOM saja juga akan salah. Yang tahu bedanya cuma orang yang melihat isinya.

Aturan yang lebih pintar tidak menyelesaikan kasus seperti ini. Yang menyelesaikan adalah manusia yang memeriksa lalu mengunci hasilnya.

```javascript
"sulselprov.go.id": {
  siteLabel: "Sulselprov",
  verifiedLabels: {
    ".max-h-\\[240px\\]": {
      label: "Area gulir daftar Peraturan Gubernur",
      note: "Isi region adalah daftar Pergub, bukan opini.",
      verifiedOn: "2026-08-08",
    },
  },
},
```

Aturan mainnya:

- Kuncinya adalah selector yang dilaporkan axe, bisa dilihat di `engine-result.json`
- Override naik ke confidence **1.0** dengan source `verified-override`
- Angka 1.0 hanya boleh lahir dari sini. Tidak ada heuristik yang boleh mencapainya
- Source dan confidence lama disimpan di `supersededSource` dan `supersededConfidence`, jadi jejak auditnya tidak hilang
- Setiap override wajib punya `note` dan `verifiedOn`, dan ada unit test yang mengeceknya
- Selector di config yang tidak ditemukan di halaman dilaporkan sebagai `staleOverrides`, supaya override basi ketahuan dan bisa dihapus

## Cara engine memberi nama tombol

Engine membaca sinyal yang benar-benar ada di HTML, semuanya generik:

1. Nilai atribut `data-action` atau `data-command`
2. Nama atribut `data-*` yang berakhiran kata aksi, misalnya `data-macro-prev`
3. Nama ikon dari library populer, misalnya `ph-caret-left`, `lucide-x`, `fa-times`, `bi-search`
4. Token pada `id` atau `class` tombol dengan pemecahan camelCase, misalnya `id="closeServiceModal"`
5. Posisi kontrol carousel berbasis utility class

Kata `left` dan `right` sengaja tidak dianggap kata aksi pada sinyal 2 dan 4. Class posisi seperti `right-1` tidak menjelaskan fungsi tombol. Arah hanya bermakna bila datang dari nama ikon.

Confidence dihitung dari kesepakatan sinyal, bukan dipatok:

| Kondisi | Confidence | Status |
| --- | --- | --- |
| Dikunci manusia lewat `verifiedLabels` | 1.00 | apply |
| Dua sinyal independen sepakat | 0.95 | apply |
| Satu sinyal atribut data | 0.90 | apply |
| Satu sinyal ikon atau identifier | 0.85 | apply |
| Hanya posisi carousel | 0.85 | apply |
| Hanya posisi pojok | 0.75 | review |
| Sinyal saling bertentangan | 0.60 | review |
| Tidak ada sinyal | 0.00 | skip |

## Cara engine memberi nama area gulir

Engine hanya menerima heading yang **mendahului** area gulir, maksimal 60 karakter, dan berhenti di batas section. Heading di dalam area gulir diabaikan, karena pada daftar berita heading pertama adalah judul item, bukan nama section. Heading milik section tetangga juga diabaikan.

Bila tidak ada heading yang layak, engine memakai label generik `Daftar konten yang dapat digulir` dengan confidence 0.8.

## Peringatan yang dilaporkan engine

Dua hal ini dilaporkan sebagai peringatan, bukan kegagalan. Patch tetap diterapkan.

**`duplicateLabels`** berisi nama yang kembar setelah patch. Nama kembar lolos axe tetapi menyusahkan pengguna nyata. Pengguna NVDA yang menekan B untuk lompat antar tombol akan mendengar "Media sebelumnya" empat kali tanpa tahu mana yang mana. Menyelesaikannya butuh konteks section yang belum kita punya, dan kita tidak mau mengarang.

**`staleOverrides`** berisi selector di `verifiedLabels` yang tidak ditemukan di halaman. Biasanya berarti situsnya berubah, atau pemilik situs sudah memperbaiki sendiri masalahnya.

## Kebijakan confidence

Default:

```text
>= 0.80   diterapkan
0.60-0.79 masuk review
< 0.60    dilewati
```

Dapat diubah:

```javascript
const result = await remediatePage({
  page,
  axeResult: before,
  confidencePolicy: {
    applyThreshold: 0.85,
    reviewThreshold: 0.6,
  },
});
```

## Pemakaian sebagai modul

```javascript
import AxeBuilder from "@axe-core/playwright";
import { remediatePage, createRegressionReport } from "./src/engine/index.mjs";
import { getSiteConfig } from "./src/config/sites.mjs";

const before = await new AxeBuilder({ page }).analyze();

const result = await remediatePage({
  page,
  axeResult: before,
  config: getSiteConfig(page.url()),
});

const after = await new AxeBuilder({ page }).analyze();
const regression = createRegressionReport(before, after);

console.log(result.metrics);
console.log(result.duplicateLabels);
console.log(regression.clean);
```

Engine menjalankan baseline tiga rule target sendiri, jadi `axeResult` yang dikirim boleh berupa pemindaian luas berbasis tag WCAG. Baseline metrik tetap adil.

## Rollback dan regression

Setiap patch mencatat nilai lama. Bila hasil setelah patch memburuk pada salah satu rule target, seluruh patch dibatalkan otomatis dan `rolledBack` bernilai `true`.

`metrics.noRegression` hanya mengukur tiga rule target. Untuk memeriksa di luar itu, `test:engine` menjalankan pemindaian WCAG luas dua kali dan menyimpan hasilnya di `wcagRegression`.

Satu catatan jujur: halaman berita itu dinamis. Carousel berputar dan angka bisa bergeser sedikit antara dua pemindaian tanpa ada hubungannya dengan patch. Jadi `wcagRegression` adalah petunjuk kuat, bukan bukti matematis. Kalau ada rule yang memburuk, periksa manual sebelum menyimpulkan.

Elemen yang diperbaiki diberi penanda `data-project-a-fixed`, `data-project-a-source`, dan `data-project-a-confidence` supaya mudah diaudit.

## Batasan versi 0.1.3

- Belum memperbaiki `image-alt`.
- Belum memperbaiki `color-contrast`.
- Belum menangani iframe atau shadow DOM target.
- Tidak membuka atau mengambil URL sendiri, pemanggil yang menyediakan `page`.
- Tidak memproses form, login, pembayaran, atau CAPTCHA.
- Generic URL slug hanya menjadi saran review.
- Nama kembar dilaporkan tetapi belum diperbaiki otomatis.
- Selector pada `verifiedLabels` mengikuti selector axe, dan bisa berubah kalau situsnya di-redesign.
- Hasil otomatis tetap perlu diperiksa manusia.

## Struktur penting

```text
src/config/sites.mjs            satu-satunya tempat konfigurasi per situs
src/engine/index.mjs            orkestrasi engine
src/engine/apply-patch.mjs      kebijakan apply dan rollback
src/engine/verified-labels.mjs  penerapan label yang dikunci manusia
src/engine/report.mjs           metrics, regression, deteksi nama kembar
src/rules/                      resolver masing-masing rule
scripts/test-engine.mjs         pengujian pada halaman live
tests/                          unit test dan fixtures lokal
```
