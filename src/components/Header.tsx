"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

const navItems = [
  { href: "/", label: "Beranda" },
  { href: "/katalog", label: "Riwayat" },
  { href: "/cara-kerja", label: "Cara Kerja" },
  { href: "/about", label: "Tentang" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
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
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? `${styles.navLink} ${styles.navLinkActive}`
                    : styles.navLink
                }
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
