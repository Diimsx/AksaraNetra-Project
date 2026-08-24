"use client";

import { useEffect, useState } from "react";
import styles from "./NotificationBar.module.css";

const KUNCI_PENYIMPANAN = "aksaranetra-info-diterima";

/**
 * Bar informasi di bagian bawah layar, mengikuti pola pada acuan desain:
 * teks di kiri, satu tombol pill di kanan. Dipakai di sini untuk
 * menjelaskan sifat AksaraNetra sebagai alat bantu tidak resmi, bukan
 * untuk consent cookie (situs ini tidak memasang cookie pelacakan).
 *
 * Statusnya disimpan di localStorage supaya tidak muncul berulang pada
 * kunjungan berikutnya di perangkat yang sama.
 */
export default function NotificationBar() {
  const [terlihat, setTerlihat] = useState(false);

  useEffect(() => {
    try {
      const sudahDiterima = localStorage.getItem(KUNCI_PENYIMPANAN);
      if (!sudahDiterima) setTerlihat(true);
    } catch {
      // localStorage tidak tersedia (mode privat, dsb). Bar cukup disembunyikan.
    }
  }, []);

  const tutup = () => {
    setTerlihat(false);
    try {
      localStorage.setItem(KUNCI_PENYIMPANAN, "1");
    } catch {
      // Tidak masalah kalau gagal disimpan; bar akan muncul lagi di kunjungan
      // berikutnya, yang tidak merusak apa pun.
    }
  };

  if (!terlihat) return null;

  return (
    <div className={styles.bar} role="status">
      <p className={styles.teks}>
        AksaraNetra adalah alat bantu tidak resmi. Pemeriksaan dilakukan pada
        salinan halaman, dan situs aslinya tidak diubah dengan cara apa pun.
      </p>
      <button type="button" className={styles.tombol} onClick={tutup}>
        Mengerti
      </button>
    </div>
  );
}
