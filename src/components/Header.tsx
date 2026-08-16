"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

/**
 * Navigasi utama.
 *
 * Di layar lebar, tautan berada di bar atas.
 * Di layar sempit, tautan pindah ke navigasi bawah supaya mudah dijangkau
 * jempol dan tidak memakan ruang di atas isi halaman.
 *
 * Ikon hanya dekoratif. Setiap tujuan selalu punya label teks, dan halaman
 * yang sedang dibuka ditandai lewat aria-current, bukan hanya lewat warna.
 */

type NavItem = {
  href: string;
  label: string;
  icon: "beranda" | "riwayat" | "cara" | "tentang";
};

const navItems: NavItem[] = [
  { href: "/", label: "Beranda", icon: "beranda" },
  { href: "/katalog", label: "Riwayat", icon: "riwayat" },
  { href: "/cara-kerja", label: "Cara Kerja", icon: "cara" },
  { href: "/about", label: "Tentang", icon: "tentang" },
];

function NavIcon({ name }: { name: NavItem["icon"] }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };

  if (name === "beranda") {
    return (
      <svg {...common}>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6 10v9h12v-9" />
      </svg>
    );
  }

  if (name === "riwayat") {
    return (
      <svg {...common}>
        <path d="M12 7v5l3.5 2" />
        <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
        <path d="M3.5 4.5V9H8" />
      </svg>
    );
  }

  if (name === "cara") {
    return (
      <svg {...common}>
        <path d="M5 6h9" />
        <path d="M5 12h14" />
        <path d="M5 18h6" />
        <circle cx="17.5" cy="6" r="2" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <path d="M12 7.7h.01" />
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <Link
            href="/"
            className={styles.brand}
            aria-label="AksaraNetra, kembali ke beranda"
          >
            <Image
              src="/AN - Nav Icon.png"
              alt="AksaraNetra Logo"
              width={60}
              height={40}
              className={styles.brandTanda}
              aria-hidden="true"
            />
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

      <nav className={styles.bottomNav} aria-label="Navigasi utama halaman">
        <ul className={styles.bottomList}>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    active
                      ? `${styles.bottomLink} ${styles.bottomLinkActive}`
                      : styles.bottomLink
                  }
                  aria-current={active ? "page" : undefined}
                >
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
