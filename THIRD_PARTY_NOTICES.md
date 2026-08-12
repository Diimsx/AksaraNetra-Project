# Komponen dan Lisensi Pihak Ketiga AksaraNetra

Dokumen ini mencatat dependency dan runtime pihak ketiga yang digunakan AksaraNetra. Lisensi MIT milik AksaraNetra tidak mengganti lisensi masing-masing komponen.

| No | Komponen | Versi | Lisensi | Sumber | Penggunaan |
|---:|---|---|---|---|---|
| 1 | Next.js | 16.3.0 | MIT | https://github.com/vercel/next.js | Framework frontend dan App Router |
| 2 | React | 19.2.8 | MIT | https://github.com/facebook/react | Library UI |
| 3 | React DOM | 19.2.8 | MIT | https://github.com/facebook/react | Renderer React untuk browser |
| 4 | TypeScript | 5.9.3 | Apache-2.0 | https://github.com/microsoft/TypeScript | Pemeriksaan tipe dan kompilasi source |
| 5 | ESLint | 9.39.5 | MIT | https://github.com/eslint/eslint | Pemeriksaan kualitas source |
| 6 | eslint-config-next | 16.3.0 | MIT | https://github.com/vercel/next.js | Aturan ESLint khusus Next.js |
| 7 | Playwright | 1.62.1 | Apache-2.0 | https://github.com/microsoft/playwright | Browser automation |
| 8 | playwright-core | 1.62.1 | Apache-2.0 | https://github.com/microsoft/playwright | Implementasi inti Playwright |
| 9 | @axe-core/playwright | 4.12.1 | MPL-2.0 | https://github.com/dequelabs/axe-core | Integrasi axe dengan Playwright |
| 10 | axe-core | 4.12.1 | MPL-2.0 | https://github.com/dequelabs/axe-core | Engine audit aksesibilitas |
| 11 | Node.js | 24.14.1 | MIT | https://github.com/nodejs/node | Runtime backend dan engine |
| 12 | Chromium | 127.0.6533.17 | BSD-3-Clause dan lisensi pihak ketiga | https://chromium.googlesource.com/chromium/src | Browser audit |
| 13 | SQLite | 3.51.2 | Public Domain | https://sqlite.org/src | Penyimpanan job melalui `node:sqlite` |
| 14 | @types/node | 20.19.43 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | Type definition Node.js |
| 15 | @types/react | 19.2.18 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | Type definition React |
| 16 | @types/react-dom | 19.2.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | Type definition React DOM |

## Catatan versi runtime

Node.js 24.14.1, Chromium 127.0.6533.17, dan SQLite 3.51.2 merupakan versi eksplisit pada environment yang telah diverifikasi. Pin versi yang sama pada deployment apabila dokumen ini akan digunakan sebagai inventaris reproduktif.

Chromium memuat komponen pihak ketiga dengan pemberitahuan lisensi masing-masing. Distribusi binary Chromium harus tetap menyertakan third-party notices yang disediakan bersama distribusinya.
