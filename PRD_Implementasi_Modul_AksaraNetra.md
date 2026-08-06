# PRD Implementasi Modul — AksaraNetra

*Turunan dari Technical Plan, disesuaikan dengan scope MVP yang sudah dipersempit (3 jenis perbaikan) dan progres aktual per modul. Dokumen ini untuk level implementasi — tiap modul dilengkapi signature fungsi, logika, edge case, dan format data, supaya bisa langsung dikerjakan tanpa banyak tanya balik.*

*Status per hari ini: seluruh modul masih berstatus **belum selesai**. Modul 3 dan 4 sudah punya prototipe yang berfungsi dan sudah diuji di Sulsel, tapi belum dianggap final sampai divalidasi ulang di situs lain dan diintegrasikan penuh ke seluruh alur.*

---

## Peta Status Modul

| # | Modul | Status | Prioritas kerja |
|---|---|---|---|
| 1 | URL Validator | 🟠 Belum selesai | Berikutnya, setelah pengujian Kepri selesai |
| 2 | Page Fetcher | 🟠 Belum selesai | Bareng dengan Modul 1 |
| 3 | Accessibility Analyzer | 🟠 Belum selesai (prototipe sudah diuji, belum difinalisasi) | Lanjutkan setelah pengujian Kepri |
| 4 | Remediation Engine | 🟠 Belum selesai (prototipe sudah diuji di Sulsel, belum difinalisasi) | Validasi ulang di Kepri sebelum dianggap selesai |
| 5 | Renderer | 🟠 Belum selesai | Setelah Modul 1 & 2 |

> Catatan: tidak ada modul yang dianggap final sampai seluruh alur (Validator → Fetcher → Analyzer → Engine → Renderer) teruji end-to-end dan hasil di Sulsel terverifikasi ulang di situs lain (Kepri). Modul 3 dan 4 sudah punya prototipe yang berfungsi dan sudah diuji, tapi statusnya tetap "belum selesai" sampai validasi lintas-situs dan integrasi penuh selesai.

---

## Modul 1 — URL Validator

**Status: belum dikerjakan**

### Tujuan
Mencegah sistem memproses URL yang berbahaya (SSRF), tidak valid, atau situs yang secara eksplisit melarang diproses otomatis.

### Signature fungsi

```typescript
// lib/security/urlValidator.ts

type ValidationResult =
  | { valid: true; url: string }
  | { valid: false; reason: "invalid_format" | "blocked_host" | "robots_disallowed" | "too_many_redirects" };

async function validateUrl(input: string): Promise<ValidationResult>;
```

### Logika & urutan pengecekan

1. **Format**: parse dengan `new URL(input)`. Kalau gagal parse → `invalid_format`.
2. **Protokol**: hanya izinkan `http:` dan `https:`. Selain itu → `invalid_format`.
3. **Host berbahaya**: tolak jika hostname resolve ke:
   - `localhost`, `127.0.0.1`, `::1`
   - Rentang IP privat (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
   - Metadata endpoint cloud (`169.254.169.254`)
   
   → `blocked_host` jika kena salah satu.
4. **robots.txt**: fetch `{origin}/robots.txt`, cek apakah path yang diminta di-disallow untuk user-agent AksaraNetra atau `*`. Kalau dilarang → `robots_disallowed`.
5. **Redirect**: batasi maksimal 3 kali redirect. Setiap redirect, ulangi pengecekan langkah 2–4 pada URL tujuan (bukan cuma URL awal) — ini kunci supaya SSRF lewat redirect tidak lolos. Lebih dari 3 kali → `too_many_redirects`.

### Edge case yang wajib ditangani
- `robots.txt` tidak ada (404) → anggap boleh diproses (default izinkan).
- `robots.txt` timeout/gagal diambil → anggap boleh diproses, tapi catat di log sebagai peringatan (bukan blocker).
- URL dengan IP literal (misal `http://192.168.1.1/halaman`) → tetap harus lolos pengecekan host meski tidak lewat DNS resolve.

### Acceptance criteria
- [ ] URL ke `localhost`/IP privat ditolak dengan reason `blocked_host`.
- [ ] URL yang di-disallow robots.txt ditolak dengan reason `robots_disallowed`.
- [ ] Redirect ke alamat privat terdeteksi dan ditolak (bukan cuma URL awal yang dicek).
- [ ] URL valid dan diizinkan robots.txt mengembalikan `{ valid: true }`.

---

## Modul 2 — Page Fetcher

**Status: belum dikerjakan**

### Tujuan
Mengambil HTML dari URL yang sudah lolos validasi, dengan strategi bertingkat: coba cara ringan dulu, baru eskalasi kalau perlu.

### Signature fungsi

```typescript
// lib/fetch/pageFetcher.ts

type FetchResult =
  | { success: true; html: string; usedBrowser: boolean }
  | { success: false; error: "timeout" | "forbidden" | "captcha" | "ssl_error" | "unknown" };

async function fetchPage(url: string, options?: { timeoutMs?: number }): Promise<FetchResult>;
```

### Logika & urutan kerja

1. Coba `fetch()` biasa dulu dengan timeout default 10 detik.
2. Kalau HTML hasilnya terlalu kosong/minim (indikasi halaman butuh JavaScript untuk render — misal `<body>` nyaris kosong atau ukuran HTML jauh di bawah rata-rata), baru eskalasi ke Playwright Chromium. **Catatan: proses Playwright dijalankan lewat batch/GitHub Actions untuk situs demo, bukan sebagai live request pengguna** (lihat PRD Setup Development, Tahap 3).
3. Tangkap dan klasifikasikan kegagalan:
   - Status 403 → `forbidden`
   - Response mengandung indikasi CAPTCHA (misal elemen dengan `class`/`id` mengandung "captcha", atau status 429) → `captcha`
   - SSL/TLS certificate error → `ssl_error`
   - Timeout terlampaui → `timeout`
   - Lainnya → `unknown`, tetap catat pesan error asli untuk debugging.

### Edge case yang wajib ditangani
- Ukuran respons terlalu besar (misal >5MB) → hentikan fetch, perlakukan sebagai `unknown` dengan alasan khusus "response_too_large".
- Redirect yang sudah divalidasi Modul 1 tetap perlu diikuti fetcher, bukan diulang validasi di sini (validasi sudah selesai di Modul 1).

### Acceptance criteria
- [ ] Halaman statis berhasil diambil tanpa Playwright (`usedBrowser: false`).
- [ ] Halaman JS-heavy yang terdaftar di situs target berhasil diambil lewat Playwright saat dijalankan via batch.
- [ ] Kegagalan (403, timeout, CAPTCHA) diklasifikasikan dengan benar, bukan cuma "gagal" generik.

---

## Modul 3 — Accessibility Analyzer

**Status: 🟠 belum selesai — prototipe sudah berjalan dan diuji, belum difinalisasi/diintegrasikan penuh**

### Tujuan
Menjalankan axe-core pada halaman asli dan halaman hasil, menyimpan data yang bisa dipakai untuk perbandingan before/after (ini yang menghasilkan angka 20 → 4 di Sulsel).

### Signature fungsi (referensi — sesuaikan dengan implementasi aktual)

```typescript
// lib/audit/accessibilityAnalyzer.ts

interface AuditIssue {
  ruleId: string;
  impact: "minor" | "moderate" | "serious" | "critical";
  selector: string;
  nodeCount: number;
}

interface AuditResult {
  issues: AuditIssue[];
  totalCount: number;
  timestamp: string;
}

async function runAudit(html: string): Promise<AuditResult>;
```

### Catatan implementasi
- Dijalankan dua kali per situs: sekali pada HTML asli, sekali pada HTML hasil remediation — hasil keduanya disimpan terpisah untuk dibandingkan.
- Untuk scope MVP saat ini, filter hasil audit ke 3 kategori rule axe-core yang relevan (accessible name link, accessible name button, keyboard-accessible scroll region) supaya laporan tidak bercampur dengan masalah lain yang belum ditangani engine.

### Acceptance criteria
- [x] Audit sebelum dan sesudah tersimpan dan bisa dibandingkan. *(terbukti lewat pengujian Sulsel)*
- [x] Rule ID, impact, selector, dan jumlah node tercatat per masalah. *(terbukti lewat pengujian Sulsel)*
- [ ] Hasil audit konsisten saat dijalankan pada situs Kepri tanpa mengubah kode.
- [ ] Modul terintegrasi penuh dengan Modul 1, 2, dan 5 dalam satu alur otomatis (saat ini masih dijalankan terpisah lewat script pengujian).

---

## Modul 4 — Remediation Engine

**Status: 🟠 belum selesai — 3 perbaikan sudah diimplementasikan dan diuji di Sulsel, belum difinalisasi/divalidasi lintas situs**

### Tujuan
Memperbaiki 3 jenis masalah aksesibilitas yang jadi fokus MVP awal, tanpa memaksakan perbaikan pada elemen yang levelnya kurang jelas.

### Signature fungsi (referensi)

```typescript
// lib/remediation/engine.ts

interface RemediationResult {
  html: string;
  fixed: RemediatedElement[];
  manualReview: ManualReviewItem[];
}

interface RemediatedElement {
  type: "link_name" | "button_name" | "scroll_keyboard";
  selector: string;
  before: string | null;
  after: string;
}

interface ManualReviewItem {
  type: "link_name" | "button_name";
  selector: string;
  reason: "no_context_found";
}

function remediate(html: string): RemediationResult;
```

### Logika per jenis perbaikan

**1. Link tanpa accessible name**
- Cek urutan sumber konteks: teks visible di dalam `<a>` → `title` attribute → `alt` gambar di dalam link → teks elemen sekitar (misal parent langsung).
- Kalau salah satu sumber ditemukan dan tidak kosong, gunakan sebagai `aria-label`.
- Kalau tidak ada satu pun sumber yang valid → masuk `manualReview` dengan alasan `no_context_found`, HTML tidak diubah untuk elemen itu.

**2. Button tanpa accessible name**
- Logika sama seperti link: teks visible → `title` → `aria-label` yang sudah ada tapi kosong (isi ulang jika ada indikasi dari `class`/`data-*` attribute yang umum dipakai, misal `class="icon-close"` → beri label "Tutup") → parent context.
- Kalau tidak ketemu → `manualReview`.

**3. Scroll area tidak bisa diakses keyboard**
- Deteksi elemen dengan CSS `overflow: auto` atau `overflow: scroll` yang punya `scrollHeight > clientHeight` atau `scrollWidth > clientWidth`.
- Tambahkan `tabindex="0"` jika belum ada.
- Tambahkan role `region` + `aria-label` deskriptif jika elemen belum punya accessible name (opsional, tingkatkan kalau axe-core masih menandai setelah `tabindex` ditambahkan).
- Ini murni berbasis aturan/deteksi CSS, tidak butuh "konteks makna" seperti dua kasus di atas — jadi selalu diperbaiki otomatis, tidak ada jalur manual review untuk kasus ini.

### Catatan progres
Tiga perbaikan (link, button, scroll area) sudah berfungsi dan teruji di Sulsel dengan hasil 20 → 4 masalah, tapi modul ini **belum ditutup statusnya sebagai selesai** sampai: (1) hasil serupa terverifikasi di situs lain, dan (2) sudah diverifikasi manual lewat keyboard/NVDA testing, bukan hanya lewat angka axe-core.

### Yang sengaja belum diimplementasikan (di luar scope saat ini)
Delapan langkah remediation di Technical Plan asli (set title/lang, skip link, focus indicator, label form, alt text gambar, dst.) **belum semuanya masuk MVP** — saat ini engine hanya menangani 3 kasus di atas. Langkah lain menyusul sebagai perluasan scope (P1), termasuk penggunaan model vision untuk alt text yang **sengaja belum dipakai** di versi ini (murni heuristik berbasis konteks HTML, bukan AI generatif) — jadi penanda "[perkiraan]" untuk konten AI belum relevan diterapkan sampai model vision benar-benar diaktifkan.

### Acceptance criteria
- [x] Jumlah pelanggaran axe-core terkait 3 kategori target menurun signifikan pada halaman hasil dibanding asli (terbukti di Sulsel: 20 → 4).
- [x] Tidak ada accessible name yang dipaksakan tanpa dasar konteks — elemen tanpa konteks masuk manual review, bukan ditebak.
- [ ] Hasil serupa didapat di situs Kepri tanpa mengubah kode engine.
- [ ] Hasil sudah diverifikasi manual dengan keyboard testing dan NVDA testing (bukan cuma lewat angka axe-core).
- [ ] Modul dianggap selesai setelah dua poin di atas terpenuhi dan terintegrasi dengan Modul 1, 2, dan 5.

---

## Modul 5 — Renderer

**Status: belum dikerjakan**

### Tujuan
Menyiapkan HTML hasil remediation supaya aman dan siap ditampilkan ke pengguna lewat Reader View.

### Signature fungsi

```typescript
// lib/render/renderer.ts

interface RenderResult {
  safeHtml: string;
  manualReviewSummary: ManualReviewItem[];
}

function prepareForDisplay(remediationResult: RemediationResult, baseUrl: string): RenderResult;
```

### Logika & urutan kerja

1. **Resolve relative URL**: semua `href` dan `src` yang relatif diubah jadi absolute URL berdasarkan `baseUrl` (URL asli situs), supaya aset (gambar, CSS) tetap tampil benar.
2. **Sanitasi HTML**: jalankan lewat `sanitize-html` untuk membuang `<script>` dan atribut event handler inline (`onclick`, dst) yang tidak diperlukan.
3. **Injeksi disclaimer**: tambahkan elemen banner di awal `<body>` (posisi pertama dalam urutan baca) yang menyatakan ini versi tidak resmi buatan AksaraNetra, bukan situs asli.
4. **Injeksi skip link**: tambahkan skip link ke elemen `<main>` (atau area konten utama) di paling awal, sebelum disclaimer atau langsung sesudahnya — urutan pastinya perlu diuji dengan NVDA supaya tidak membingungkan.
5. Kembalikan `manualReviewSummary` untuk dipakai fitur "unduh laporan ke pengelola situs" (bukan ditampilkan sebagai bagian dari halaman hasil ke pengguna akhir).

### Edge case yang wajib ditangani
- Halaman tidak punya elemen `<main>` sama sekali → beri fallback: bungkus seluruh konten dalam elemen `<main>` buatan sebelum injeksi skip link.
- HTML asli sudah punya `<script>` yang legitimate untuk styling dinamis penting → didokumentasikan sebagai limitation, bukan dipertahankan (prinsip: lebih aman menghapus daripada berisiko script berbahaya lolos).

### Acceptance criteria
- [ ] Semua aset relatif tetap tampil benar (tidak ada gambar/style rusak akibat path relatif salah).
- [ ] Tidak ada `<script>` aktif yang lolos ke HTML final.
- [ ] Disclaimer dan skip link ada di urutan baca paling awal saat diuji dengan NVDA.
- [ ] Halaman hasil bisa dinavigasi penuh dengan keyboard tanpa keyboard trap.

---

## Urutan Kerja yang Disarankan

1. Selesaikan pengujian Kepri & keyboard/NVDA testing pada Modul 4 (Remediation Engine) yang sudah ada — pastikan tidak perlu perubahan sebelum modul lain dibangun di atasnya.
2. Bangun Modul 1 (URL Validator) — tidak bergantung modul lain, bisa dikerjakan paralel oleh anggota berbeda.
3. Bangun Modul 2 (Page Fetcher) — bergantung pada Modul 1 untuk tahu URL mana yang boleh diambil.
4. Bangun Modul 5 (Renderer) — bergantung pada output Modul 3 & 4 yang sudah ada.
5. Integrasikan kelima modul jadi satu alur: Validator → Fetcher → Analyzer → Engine → Renderer.
6. Uji ulang end-to-end dengan NVDA dan keyboard sebelum lanjut ke validasi ULD.

---

*Dokumen ini melengkapi PRD Pengembangan dan PRD Setup Development AksaraNetra — fokusnya khusus pada detail teknis tiap modul untuk siap dikerjakan langsung oleh developer.*
