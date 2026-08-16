"use client";

import Link from "next/link";
import styles from "./Footer.module.css";

/**
 * Footer editorial.
 *
 * Isinya tiga hal saja: identitas singkat, navigasi cepat, dan keterangan
 * tentang status alat ini. Navigasi di sini mengulang navbar dengan sengaja,
 * karena pengguna yang sudah membaca sampai bawah tidak perlu naik lagi.
 *
 * Tahun dihitung dari tanggal berjalan, bukan ditulis manual, supaya tidak
 * pernah lagi tertinggal seperti sebelumnya.
 */

const tautan = [
  { href: "/", label: "Beranda" },
  { href: "/katalog", label: "Riwayat" },
  { href: "/cara-kerja", label: "Cara Kerja" },
  { href: "/about", label: "Tentang" },
];

export default function Footer() {
  const tahun = new Date().getFullYear();

  return (
    <footer className={`${styles.footer} texture-grid`} role="contentinfo">
      <div className={styles.footerContainer}>
        <div className={styles.identitas}>
          <p className={styles.merek}>AksaraNetra</p>
          <p className={styles.ringkas}>
            Memeriksa hambatan pada halaman publik, mencoba perbaikannya, lalu
            menyiapkan versi yang lebih mudah dibaca.
          </p>
          <span className={styles.garisAksen} aria-hidden="true" />
        </div>

        <nav className={styles.navigasi} aria-label="Navigasi footer">
          <p className={styles.navJudul}>Navigasi</p>
          <ul className={styles.navDaftar}>
            {tautan.map((item) => (
              <li key={item.href}>
                <Link className={styles.navTautan} href={item.href}>
                  <span>{item.label}</span>
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    className={styles.navPanah}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h13" />
                    <path d="M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className={styles.barisBawah}>
        <div className={styles.barisBawahIsi}>
          <p className={styles.copyright}>&copy; {tahun} AksaraNetra</p>
          <p className={styles.penyangkalan}>
            Alat bantu tidak resmi. Bukan situs resmi pemerintah, dan tidak
            mengubah situs aslinya.
          </p>
        </div>
      </div>
    </footer>
  );
}
