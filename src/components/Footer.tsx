"use client";

import Link from "next/link";
import Image from "next/image";
import styles from "./Footer.module.css";

const tautan = [
  { href: "/", label: "Beranda" },
  { href: "/katalog", label: "Riwayat" },
  { href: "/periksa", label: "Mulai Periksa" },
];

export default function Footer() {
  const tahun = new Date().getFullYear();

  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.footerContainer}>
        {/* Kolom Kiri: Logo + Identitas Merek */}
        <div className={styles.identitasWrapper}>
          <Link href="/" className={styles.brandIconCard} aria-label="AksaraNetra, kembali ke beranda">
            <Image
              src="/AN - Nav Icon.png"
              alt="AksaraNetra Logo"
              width={42}
              height={42}
              className={styles.brandIconImg}
            />
          </Link>

          <div className={styles.identitasContent}>
            <p className={styles.merek}>AksaraNetra</p>
            <p className={styles.ringkas}>
              Memeriksa hambatan pada halaman publik, mencoba perbaikannya, lalu
              menyiapkan versi yang lebih mudah dibaca.
            </p>
            <span className={styles.garisAksen} aria-hidden="true" />
          </div>
        </div>

        {/* Kolom Kanan: Navigasi (3 Tombol dengan Divider & Panah) */}
        <nav className={styles.navigasi} aria-label="Navigasi footer">
          <p className={styles.navJudul}>NAVIGASI</p>
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

      {/* Baris Bawah / Hak Cipta & Penafian */}
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
