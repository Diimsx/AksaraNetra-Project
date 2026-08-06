# PRD Setup Development — AksaraNetra

*Dokumen ini menjelaskan requirement untuk lingkungan development AksaraNetra: tools, struktur repo, konvensi kerja, dan tahapan setup — disesuaikan dengan progres aktual (engine sudah jalan di Node.js, Safe URL Fetcher & Reader View belum dibangun).*

---

## 1. Tujuan Dokumen

Memastikan seluruh anggota tim bisa menjalankan, mengembangkan, dan menguji AksaraNetra di lingkungan yang **konsisten**, tanpa perbedaan versi tools atau struktur folder yang bikin kerja jadi bentrok saat digabung.

---

## 2. Ruang Lingkup Setup

Setup ini mencakup dua bagian besar:

1. **Lingkungan yang sudah berjalan** — dipakai untuk Remediation Engine dan Accessibility Analyzer (JavaScript/Node.js, sudah diuji di Sulsel).
2. **Lingkungan yang perlu ditambahkan** — untuk Safe URL Fetcher dan Reader View, yang akan menyatukan engine ke dalam aplikasi web yang bisa diakses pengguna.

---

## 3. Prasyarat & Tools

| Tools | Versi minimum | Kebutuhan |
|---|---|---|
| Node.js | 18 LTS ke atas | Wajib — menjalankan engine, fetcher, dan web app |
| npm | Bawaan Node.js | Wajib — package manager |
| Git | Versi terbaru | Wajib — version control |
| Akun GitHub | — | Wajib — hosting repo, GitHub Actions |
| Akun Vercel | — | Wajib — deployment (bisa daftar pakai akun GitHub) |
| Code editor (VS Code disarankan) | — | Opsional, tapi disarankan untuk konsistensi extension (ESLint, Prettier) |
| NVDA | Versi terbaru | Wajib — untuk testing, khusus anggota yang pegang bagian testing |
| Playwright browser binary | Terpasang via `npx playwright install` | Wajib — dipakai axe-core untuk audit |

**Catatan platform:** kalau anggota tim pakai Windows, gunakan **PowerShell**, bukan Command Prompt (cmd.exe) — beberapa command Unix-style (seperti `mkdir -p`) tidak dikenali cmd.exe dan akan gagal.

---

## 4. Struktur Repository (Target)

```
/engine              # Remediation engine & accessibility analyzer (sudah ada, JS/Node.js)
  /remediation
  /audit
/lib
  /fetch              # Safe URL Fetcher — BELUM DIBANGUN
  /security           # Validasi URL, cek robots.txt, anti-SSRF — BELUM DIBANGUN
  /types
/app                  # Web application (Reader View) — BELUM DIBANGUN
  /api/process
  /result
  page.tsx
/tests
  /accessibility
  /fixtures
/scripts
  scan.mjs            # Script pengujian batch (dipakai untuk uji Sulsel/Kepri/Bengkulu)
/docs
  PRD_Pengembangan_AksaraNetra.md
  PRD_Setup_Development_AksaraNetra.md
```

> Kalau struktur folder engine yang sudah jalan saat ini berbeda dari target di atas, langkah pertama setup adalah **merapikan/memindahkan kode existing** ke struktur ini sebelum menambah modul baru — supaya tidak ada kode bercampur tanpa pola yang jelas.

---

## 5. Tahapan Setup

### Tahap 1 — Environment Dasar
**Status: sudah berjalan** (dipakai untuk engine yang sudah diuji)

- [x] Node.js & npm terpasang.
- [x] Git & repo GitHub aktif.
- [x] Dependencies untuk engine (parsing HTML, axe-core, Playwright) terpasang.

```bash
npm install cheerio
npm install -D @axe-core/playwright playwright
npx playwright install chromium
```

### Tahap 2 — Rapikan Struktur Repo Sesuai Target
**Status: perlu dilakukan sebelum lanjut ke modul baru**

- [ ] Pindahkan kode Remediation Engine & Accessibility Analyzer yang sudah ada ke folder `/engine`.
- [ ] Pastikan `scripts/scan.mjs` bisa dipakai ulang untuk uji Kepri tanpa mengubah kode engine (sesuai rencana pengujian berikutnya).
- [ ] Tambahkan `.gitignore` untuk `node_modules`, `.env.local`, dan file hasil audit yang tidak perlu di-commit.

### Tahap 3 — Setup Web Application (untuk Reader View & Fetcher)
**Status: belum dimulai — dikerjakan setelah pengujian Kepri & keyboard/NVDA testing selesai**

```bash
npx create-next-app@latest . --typescript --eslint --app --src-dir --import-alias "@/*"
```

- [ ] Web app Next.js + TypeScript terpasang di root repo (menyatu dengan `/engine` yang sudah ada, bukan project terpisah).
- [ ] Folder `/lib/fetch` dan `/lib/security` dibuat untuk Safe URL Fetcher.
- [ ] Folder `/app/api/process` dan `/app/result` dibuat untuk alur input → hasil.

### Tahap 4 — Testing Tools
**Status: sudah berjalan sebagian (axe-core, Playwright), keyboard/NVDA manual menyusul**

- [x] axe-core & Playwright terpasang dan dipakai untuk audit before/after.
- [ ] Checklist keyboard testing & NVDA testing (sudah ada di Testing Guide) mulai dijalankan pada hasil remediation, bukan cuma di level kode.

### Tahap 5 — CI/CD (GitHub Actions)
**Status: belum dibuat**

- [ ] Buat `.github/workflows/scan.yml` untuk menjalankan `scripts/scan.mjs` secara batch (dipakai untuk audit terjadwal ke situs target, dan untuk pengujian Kepri/Bengkulu tanpa membebani mesin lokal).

```yaml
name: Scheduled Accessibility Scan
on:
  workflow_dispatch:
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: node scripts/scan.mjs
```

### Tahap 6 — Deployment (Vercel)
**Status: belum dibuat — dikerjakan setelah Reader View siap ditampilkan**

- [ ] Hubungkan repo ke Vercel (`vercel login` → `vercel`).
- [ ] Pastikan environment variable (kalau ada, misal API key model vision di masa depan) diset lewat dashboard Vercel, bukan hardcode di kode.

---

## 6. Konvensi Kerja

- Branch utama (`main`) harus selalu bisa dijalankan tanpa error.
- Buat branch kecil per task/modul (misal `feature/safe-url-fetcher`, `feature/reader-view`).
- Semua perubahan kode masuk lewat pull request, minimal 1 anggota lain melakukan review sebelum merge.
- Perubahan dokumentasi ringan (seperti update PRD) boleh langsung di-merge oleh penulisnya.
- Hindari pull request besar yang mencampur banyak modul sekaligus — ini penting khususnya saat merapikan struktur repo di Tahap 2, supaya review tetap gampang ditelusuri.

---

## 7. Environment Variables

Untuk tahap sekarang, `.env.local` masih kosong karena:
- Model vision (AI) belum dipakai — dijadwalkan opsional/P1 pada tahap berikutnya.
- Belum ada API key atau kredensial lain yang dibutuhkan oleh Remediation Engine atau Accessibility Analyzer.

Kalau nanti Safe URL Fetcher atau Reader View butuh konfigurasi (misal batas timeout, daftar situs target), simpan sebagai environment variable, bukan nilai hardcoded di kode:

```bash
# .env.local (contoh, isi menyusul sesuai kebutuhan modul)
FETCH_TIMEOUT_MS=10000
```

---

## 8. Acceptance Criteria — "Setup Dianggap Selesai"

- [ ] Semua anggota tim bisa clone repo dan menjalankan engine + test suite secara lokal tanpa error, mengikuti langkah di dokumen ini.
- [ ] Struktur folder sudah sesuai target di Bagian 4.
- [ ] `scripts/scan.mjs` bisa dijalankan ulang untuk situs baru (Kepri) tanpa mengubah kode engine.
- [ ] GitHub Actions workflow berhasil dijalankan minimal sekali secara manual (`workflow_dispatch`).
- [ ] Branch protection rule aktif di `main` (wajib pull request + review).
- [ ] Web app Next.js berhasil di-deploy ke Vercel dan bisa diakses lewat URL publik (boleh masih halaman kosong/placeholder di tahap awal).

---

*Catatan: dokumen ini melengkapi PRD Pengembangan AksaraNetra — fokusnya khusus pada kesiapan lingkungan development, bukan requirement fitur produk.*
