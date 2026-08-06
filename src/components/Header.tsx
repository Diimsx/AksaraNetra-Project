'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Header.module.css';

export default function Header() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Beranda' },
    { href: '/cara-kerja', label: 'Cara Kerja' },
  ];

  return (
    <header className={styles.header} role="banner">
      <div className={styles.headerContainer}>
        <Link href="/" className={styles.brand} aria-label="AksaraNetra — Kembali ke beranda">
          AksaraNetra
        </Link>
        <nav className={styles.nav} aria-label="Navigasi utama">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${pathname === item.href ? styles.navLinkActive : ''}`}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
