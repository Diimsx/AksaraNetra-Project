"use client";

import { useUngkap } from "@/lib/use-ungkap";

/**
 * Halaman "Tentang" adalah Server Component supaya metadata SEO tetap
 * dirender di server. Komponen kecil ini satu-satunya bagian yang jadi
 * client, hanya untuk menyalakan animasi ungkap-saat-digulir. Tidak
 * merender apa pun ke DOM.
 */
export default function AboutReveal() {
  useUngkap();
  return null;
}
