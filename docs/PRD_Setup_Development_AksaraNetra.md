# PRD Teknis AksaraNetra

## Tujuan

Membuat tampilan reader dan laporan audit terukur untuk halaman publik tanpa mengubah situs sumber.

## Arsitektur

- Frontend Next.js di Vercel.
- Backend Node.js + Chromium di VPS.
- SQLite untuk status antrean dan filesystem persisten untuk artefak.
- Satu engine Playwright + axe untuk semua audit; tidak ada mode cepat.

## Alur pengguna

1. Pengguna memasukkan URL publik.
2. Jika hasil tersimpan tersedia, pengguna memilih menggunakannya atau audit ulang.
3. Backend membuat job anonim bertoken dan memasukkannya ke antrean.
4. Frontend menampilkan persen dan tahap nyata, dapat dipulihkan setelah refresh, serta menyediakan pembatalan.
5. Setelah selesai, pengguna memilih **Buka hasil**.
6. Hasil berisi reader, perbandingan sebelum/sesudah, status patch, screenshot, dan PDF.

## Batas operasional

- Maksimal satu audit aktif.
- Timeout 180 detik.
- Retry sekali hanya untuk error sementara.
- Sandbox 10 audit/IP/jam; production 5.
- Artefak kedaluwarsa setelah 7 hari.
- Halaman harus publik, tanpa login, dan mematuhi robots.txt.

## Acceptance criteria

- Patch hanya dihitung fixed setelah target terverifikasi hilang.
- Patch bermasalah di-rollback per elemen.
- Job tidak dapat dibaca/dibatalkan tanpa access token.
- Link artefak memakai share token terpisah.
- Progress tidak bergerak linear palsu dan diumumkan hanya saat tahap berubah.
- Refresh melanjutkan job melalui jobId di URL dan token di localStorage.
- Frontend tidak merender HTML sumber dengan `dangerouslySetInnerHTML`.
- Reader dan UI lolos pemeriksaan axe yang tersedia serta QA keyboard/mobile.
