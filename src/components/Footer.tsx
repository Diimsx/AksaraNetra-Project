'use client';

import styles from './Footer.module.css';

/**
 * Footer satu baris.
 *
 * Tidak ada navigasi di sini. Semua tautan sudah naik ke navbar, termasuk
 * Keterbatasan yang tadinya hanya bisa dicapai dari footer.
 *
 * Tahun dihitung dari tanggal berjalan, bukan ditulis manual, supaya tidak
 * pernah lagi tertinggal seperti sebelumnya.
 */
export default function Footer() {
  const tahun = new Date().getFullYear();

  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.footerContainer}>
        <p className={styles.copyright}>
          &copy; {tahun} AksaraNetra
        </p>
        <p className={styles.penyangkalan}>
          Alat bantu tidak resmi. Bukan situs resmi pemerintah, dan tidak mengubah
          situs aslinya.
        </p>
      </div>
    </footer>
  );
}
