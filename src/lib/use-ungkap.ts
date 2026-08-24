"use client";

import { useEffect } from "react";

/**
 * Mengaktifkan animasi "ungkap saat digulir" untuk semua elemen berkelas
 * `.ungkap` di dalam halaman yang memanggil hook ini.
 *
 * Kalau JavaScript tidak berjalan, `body` tidak pernah mendapat kelas
 * `js-tidak-aktif`, tapi itu tidak masalah: aturan CSS untuk `.ungkap`
 * sudah memberi opacity 1 secara statis lewat `@media` fallback yang tidak
 * bergantung pada JS. Hook ini murni progressive enhancement.
 *
 * prefers-reduced-motion dihormati: elemen langsung ditandai terlihat
 * tanpa observer, supaya tidak ada gerak sama sekali.
 */
export function useUngkap() {
  useEffect(() => {
    const elems = document.querySelectorAll<HTMLElement>(".ungkap");
    if (elems.length === 0) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReduced) {
      elems.forEach((el) => el.classList.add("terlihat"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("terlihat");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    elems.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);
}
