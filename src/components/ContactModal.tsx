"use client";

import { useEffect, useRef, type FormEvent } from "react";
import styles from "./ContactModal.module.css";

type Props = {
  terbuka: boolean;
  tutup: () => void;
};

/**
 * Modal kontak, mengikuti pola pada acuan desain: kartu besar melengkung
 * dengan latar gradien ungu di satu sisi, dan bentuk-bentuk kecil sebagai
 * hiasan. Form ini tidak benar-benar mengirim pesan ke server manapun
 * (belum ada backend untuk itu) — mengirim menampilkan pesan konfirmasi
 * saja, supaya tidak ada janji yang tidak bisa dipenuhi.
 */
export default function ContactModal({ terbuka, tutup }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terbuka) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input, textarea")?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") tutup();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [terbuka, tutup]);

  if (!terbuka) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    tutup();
  };

  return (
    <div className={styles.overlay} onClick={tutup}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.tutupBtn}
          onClick={tutup}
          aria-label="Tutup formulir kontak"
        >
          ✕
        </button>

        <div className={styles.blobHias} aria-hidden="true" />

        <h2 id="contact-modal-title" className={styles.judul}>
          Sapa Kami
        </h2>
        <p className={styles.subjudul}>
          Ada pertanyaan, masukan, atau menemukan halaman yang salah
          dinilai? Kirimkan lewat formulir ini.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label htmlFor="contact-name">Nama Anda</label>
              <input id="contact-name" type="text" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="contact-email">Email Anda</label>
              <input id="contact-email" type="email" required />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="contact-message">Pesan Anda</label>
            <textarea id="contact-message" rows={4} required />
          </div>
          <button type="submit" className={styles.kirimBtn}>
            Kirim pesan
          </button>
        </form>
      </div>
    </div>
  );
}
