"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

/**
 * Navbar yang menempel di atas layar.
 *
 * Semua tautan situs berkumpul di sini, termasuk yang tadinya hanya ada di
 * footer. Navigasi yang hanya tersedia di footer memaksa pengguna keyboard
 * menekan Tab melewati seluruh isi halaman untuk mencapainya.
 */

const navItems = [
  { href: "/", label: "Beranda" },
  { href: "/katalog", label: "Hasil Audit" },
  { href: "/cara-kerja", label: "Cara Kerja" },
  { href: "/about", label: "Tentang" },
];

export default function Header() {
  const pathname = usePathname();
  const [digulir, setDigulir] = useState(false);
  const [kemajuan, setKemajuan] = useState(0);

  useEffect(() => {
    /**
     * Menghitung posisi baca sebagai persentase.
     *
     * requestAnimationFrame dipakai supaya perhitungan tidak dijalankan
     * ratusan kali per detik saat halaman digulir cepat. Tanpa itu, halaman
     * terasa berat di perangkat lama.
     */
    let menunggu = false;

    const hitung = () => {
      const atas = window.scrollY;
      const bisaDigulir =
        document.documentElement.scrollHeight - window.innerHeight;
      setDigulir(atas > 8);
      setKemajuan(
        bisaDigulir > 0 ? Math.min(100, (atas / bisaDigulir) * 100) : 0,
      );
      menunggu = false;
    };

    const saatGulir = () => {
      if (menunggu) return;
      menunggu = true;
      window.requestAnimationFrame(hitung);
    };

    hitung();
    window.addEventListener("scroll", saatGulir, { passive: true });
    window.addEventListener("resize", saatGulir);
    return () => {
      window.removeEventListener("scroll", saatGulir);
      window.removeEventListener("resize", saatGulir);
    };
  }, []);

  return (
    <header
      className={
        digulir ? `${styles.header} ${styles.headerDigulir}` : styles.header
      }
      role="banner"
    >
      <div className={styles.headerContainer}>
        <Link
          href="/"
          className={styles.brand}
          aria-label="AksaraNetra, kembali ke beranda"
        >
          <span className={styles.brandTanda} aria-hidden="true">
            AN
          </span>
          <span className={styles.brandNama}>AksaraNetra</span>
        </Link>

        <nav className={styles.nav} aria-label="Navigasi utama">
          {navItems.map((item) => {
            const aktif = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  aktif
                    ? `${styles.navLink} ${styles.navLinkActive}`
                    : styles.navLink
                }
                aria-current={aktif ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/*
        Indikator posisi baca. Sengaja disembunyikan dari pembaca layar.
        Dia tidak menyampaikan informasi apa pun yang tidak bisa didapat dengan
        cara lain, jadi mengumumkan persentase yang berubah terus menerus hanya
        akan mengganggu tanpa memberi manfaat.
      */}
      <div className={styles.jalurKemajuan} aria-hidden="true">
        <div className={styles.isiKemajuan} style={{ width: `${kemajuan}%` }} />
      </div>
    </header>
  );
}
