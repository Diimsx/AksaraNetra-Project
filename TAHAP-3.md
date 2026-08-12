# AksaraNetra Tahap 3

Overlay ini menghubungkan frontend Next.js ke backend job API Tahap 2 dan menghapus mode cepat lama.

1. Salin file overlay ke root repository.
2. Hapus semua path di `DELETIONS.txt`.
3. Set `NEXT_PUBLIC_AUDIT_API_URL` di Vercel.
4. Jalankan `npm ci`, `npm run lint`, `npm run build`, `npm run backend:test`, dan `npm run engine:test`.

QA sandbox: frontend contract 5/5, backend 10/10, engine 114/114, axe fixture desktop/mobile 0 violation. Build Next.js penuh perlu dijalankan di CI/Vercel karena sandbox ini tidak dapat mengunduh dependency Next.js.
