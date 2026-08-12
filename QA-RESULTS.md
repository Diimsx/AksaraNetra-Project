# QA Results

## Lulus

- Frontend contract + UI acceptance: 12/12.
- TypeScript/TSX syntax parse: lulus untuk seluruh frontend.
- Source scan: tidak ada radial gradient, warna kuning lama, instruksi `build:data`, atau token di URL riwayat.
- Kontras token teks utama: seluruh pasangan yang diuji minimal WCAG AA 4.5:1.
- Keyboard QA pada harness responsif: focus target terlihat dan urutan navigasi utama konsisten.
- Visual QA: beranda, riwayat, loading, hasil, Tentang, empty state, dan error state.
- Viewport: 320, 390, 768, dan 1440 piksel. Tidak ditemukan horizontal page overflow atau overlay intersection.
- Reduced motion: loading diperiksa pada viewport mobile dengan preferensi reduced motion.

## Belum dapat dijalankan di sandbox

- `npm run lint` dan `npm run build`: dependency Next/ESLint project tidak tersedia dan network npm tidak aktif.
- Full semantic typecheck: dependency Next dan React type project tidak tersedia. Syntax parse tetap lulus.
- Axe runtime: `@axe-core/playwright` tidak tersedia.
- Direct-open end-to-end dengan backend nyata: backend dan browser runtime project tidak dijalankan dalam scope frontend-only ini. Kontrak navigasinya diuji secara statis.

Jalankan lint, build, axe, dan smoke test backend nyata setelah overlay diterapkan pada repository yang dependency-nya sudah terpasang.
