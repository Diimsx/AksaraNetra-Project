# AksaraNetra Backend

Backend Node.js untuk antrean audit terukur. Satu worker Chromium aktif pada satu waktu; job lain tetap antre. Status tersimpan di SQLite dan artefak disimpan di filesystem selama 7 hari.

## Menjalankan

```bash
cd engine && npm ci && npx playwright install chromium
cd ../backend
cp .env.example .env
npm start
```

Node.js minimal 22.5 diperlukan karena backend memakai `node:sqlite`.

## API

- `POST /audits` body `{ "url": "https://contoh.go.id" }`
- `GET /audits/cache?url=...` untuk mengecek hasil tersimpan
- `GET /audits/:jobId` dengan `Authorization: Bearer <accessToken>`
- `GET /audits/:jobId/result` dengan token yang sama
- `DELETE /audits/:jobId` untuk membatalkan
- `GET /health`

`POST /audits` mengembalikan `jobId` dan `accessToken`. Simpan keduanya di URL state/local storage frontend. Poll status setiap 1–2 detik. Jangan log access token.

Jika cache tersedia, frontend menawarkan dua pilihan. Kirim `reuseExisting: true` untuk menyalin hasil tersimpan ke job baru, atau `false`/kosong untuk audit ulang.

Link reader/PDF memakai share token terpisah yang diturunkan dari access token, tidak memberi hak membatalkan job, dan kedaluwarsa bersama job.

## Reverse proxy

Pasang HTTPS di Nginx/Caddy, teruskan ke `127.0.0.1:8787`, batasi ukuran request, dan set `TRUST_PROXY=1` hanya jika backend memang berada di belakang proxy tepercaya.
