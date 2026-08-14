# Dockerfile untuk backend AksaraNetra.
#
# PENTING: build context harus REPO ROOT, bukan folder backend/.
# Alasan: backend/src/auditor.mjs mengimpor langsung dari
# ../../engine/src/api/index.mjs — jadi folder /engine dan /backend
# wajib jadi sibling di dalam image yang sama.
#
# Build lokal (dari repo root):
#   docker build -f backend/Dockerfile -t aksaranetra-backend .
#
# Di Render: set "Dockerfile Path" = backend/Dockerfile,
# dan "Docker Build Context Directory" = . (repo root)

FROM node:22-bookworm-slim

# node:sqlite butuh Node >=22.5 — image node:22-bookworm-slim (per Agustus 2026)
# sudah di atas itu. curl & ca-certificates dipakai playwright installer.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Install dependency engine (playwright + axe-core) lebih dulu ---
# supaya layer ini di-cache dan tidak install ulang tiap kali source berubah.
COPY engine/package.json engine/package-lock.json ./engine/
RUN cd engine && npm ci --omit=dev

# Playwright menyimpan browser di path berdasarkan user. Build berjalan
# sebagai root, tapi runtime sebagai user node. Supaya browser yang
# terinstall saat build bisa ditemukan saat runtime, pakai path bersama.
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright

# Install Chromium + dependency sistemnya (versi mengikuti yang terkunci
# di engine/package-lock.json, yaitu playwright 1.62.1)
RUN cd engine && npx playwright install --with-deps chromium

# --- Backend tidak punya dependency npm eksternal (murni node: builtin) ---
COPY backend/package.json ./backend/

# --- Salin source code ---
COPY engine/src ./engine/src
COPY backend/src ./backend/src
COPY backend/scripts ./backend/scripts

# Direktori data (SQLite + artefak audit). Di Render, mount Persistent Disk
# ke path ini supaya job & hasil audit tidak hilang saat redeploy/restart.
ENV BACKEND_DATA_DIR=/data
RUN mkdir -p /data && chown -R node:node /data /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787

# Tanpa batas eksplisit, heap V8 milik proses Node sendiri (bukan
# Chromium-nya) boleh tumbuh mengikuti default V8, yang di beberapa kondisi
# bisa lebih besar dari sisa RAM yang tersedia setelah Chromium jalan --
# di container 512MB itu berarti Node ikut menyumbang risiko OOM-kill, bukan
# cuma Chromium. 192MB memberi Node ruang lebih dari cukup untuk orkestrasi
# job (bukan Node yang merender halaman), dan memaksa GC lebih agresif
# lebih dulu ketimbang menunggu kernel yang membunuh paksa.
ENV NODE_OPTIONS=--max-old-space-size=192

EXPOSE 8787

USER node

CMD ["node", "backend/src/server.mjs"]
