'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Footer.module.css';

export default function Footer() {
  const pathname = usePathname();

  const footerLinks = [
    { href: '/about', label: 'Tentang & Keterbatasan' },
    { href: '/cara-kerja', label: 'Cara Kerja' },
    { href: '#kontak', label: 'Kontak' },
  ];

  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.footerContainer}>
        <div className={styles.footerBrand}>
          <span className={styles.footerCopyright}>
            © 2024 AksaraNetra - Layanan Aksesibilitas Digital Indonesia
          </span>
        </div>
        <nav className={styles.footerNav} aria-label="Navigasi footer">
          {footerLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.footerLink} ${pathname === item.href ? styles.footerLinkActive : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
