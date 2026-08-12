# AksaraNetra

AksaraNetra terdiri dari dua deployment dalam satu repository:

- **Frontend Next.js** di Vercel.
- **Backend Node.js + Chromium** di VPS.
- **Engine terukur** dipakai backend untuk seluruh audit. Mode cepat lama sudah dihapus.

## Development

```bash
# engine
cd engine && npm ci && npx playwright install chromium

# backend
cd backend && cp .env.example .env && npm start

# frontend (terminal lain)
cp .env.example .env.local
npm ci
npm run dev
```

Frontend membutuhkan `NEXT_PUBLIC_AUDIT_API_URL`. Backend membutuhkan `BACKEND_SECRET`, `FRONTEND_ORIGINS`, dan storage persisten; lihat `backend/README.md`.

## Quality checks

```bash
npm run lint
npm run build
npm run backend:test
npm run engine:test
```

Hasil audit anonim dilindungi token acak, satu audit berjalan pada satu waktu, dapat dibatalkan, dan kedaluwarsa setelah 7 hari.
