/**
 * Satu sumber kebenaran untuk nomor versi engine.
 *
 * Sebelumnya nomor ini ditulis tangan di src/engine/index.mjs, dan sempat
 * tertinggal di 0.1.3 sementara package.json sudah 0.1.6. Akibatnya berkas
 * bukti memuat nomor versi yang salah, dan bukti yang salah label lebih buruk
 * daripada tidak ada bukti sama sekali.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const ENGINE_VERSION = require("../../package.json").version;
