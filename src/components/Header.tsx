"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "Beranda" },
  { href: "/#cara-kerja", label: "Cara Kerja" },
  { href: "/#tentang", label: "Tentang" },
  { href: "/katalog", label: "Riwayat" },
];

export default function Header() {
  const pathname = usePathname();
  const [sectionAktif, setSectionAktif] = useState<string | null>(null);

  useEffect(() => {
    if (pathname !== "/") {
      setSectionAktif(null);
      return;
    }

    const idSection = ["hero-utama", "cara-kerja", "tentang"];
    const elems = idSection
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elems.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setSectionAktif(entry.target.id);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    elems.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/#cara-kerja") return sectionAktif === "cara-kerja";
    if (href === "/#tentang") return sectionAktif === "tentang";
    if (href === "/") {
      return pathname === "/" && (sectionAktif === null || sectionAktif === "hero-utama");
    }
    return pathname === href;
  };

  const tautanMenu = navItems.filter((item) =>
    ["/", "/#cara-kerja", "/#tentang"].includes(item.href),
  );
  const tautanUtama = navItems.find((item) => item.href === "/katalog")!;
  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (pathname === "/" && href.startsWith("/#")) {
      e.preventDefault();
      const targetId = href.replace("/#", "");
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth" });
        window.history.pushState(null, "", href);
      }
    } else if (pathname === "/" && href === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.history.pushState(null, "", "/");
    }
  };

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.history.pushState(null, "", "/");
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.pill}>
        <Link
          href="/"
          className={styles.brand}
          onClick={handleLogoClick}
          aria-label="AksaraNetra, kembali ke beranda"
        >
          <Image
            src="/AN - Nav Icon.png"
            alt="AksaraNetra Logo"
            width={32}
            height={32}
            className={styles.brandTanda}
            aria-hidden="true"
          />
        </Link>

        <span className={styles.pillDivider} aria-hidden="true" />

        <nav className={styles.nav} aria-label="Navigasi utama">
          {tautanMenu.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
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

        <div className={styles.headerAksi}>
          <Link href={tautanUtama.href} className={styles.aksiUtama}>
            {tautanUtama.label}
          </Link>
        </div>
      </div>
    </header>
  );
}
