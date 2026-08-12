# Integrasi AksaraNetra

## Arsitektur final

1. Frontend Next.js mengirim `POST /audits` ke backend VPS.
2. Backend menyimpan job di SQLite dan menjalankan maksimal satu worker Chromium.
3. Frontend memantau `GET /audits/:jobId` setiap 1,5 detik.
4. Milestone engine menghasilkan tahap dan persen nyata; UI tidak membuat progress palsu.
5. Setelah selesai, pengguna memilih **Buka hasil** lalu frontend mengambil `GET /audits/:jobId/result`.
6. Reader, patched page, screenshot, dan PDF dibuka melalui link bertoken yang kedaluwarsa.

## Resume dan keamanan

`jobId` disimpan di URL. `accessToken` hanya disimpan di localStorage browser, tidak di URL. Token status/cancel berbeda kewenangannya dari share token artefak. IP hanya dipakai dalam bentuk hash untuk rate limit.

## Cache

Frontend mengecek `GET /audits/cache?url=...`. Jika tersedia, pengguna memilih hasil tersimpan atau audit ulang. Pilihan tersimpan membuat job baru dan menyalin artefak, sehingga link tetap memiliki token dan masa berlaku sendiri.

## Deployment

- Vercel: set `NEXT_PUBLIC_AUDIT_API_URL` ke origin backend HTTPS.
- VPS: install Node.js >=22.5, dependency engine, dan browser Playwright.
- Jalankan backend lewat template systemd dan Caddy di `backend/deploy/`.
- Set `FRONTEND_ORIGINS` tepat ke origin Vercel; jangan gunakan wildcard.

Mode cepat dan endpoint `/api/process` sudah dihapus. Seluruh audit memakai engine terukur.
