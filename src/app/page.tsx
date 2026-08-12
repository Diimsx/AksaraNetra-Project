"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

const EXAMPLE_SITES = [
  { url: "https://sulselprov.go.id", label: "sulselprov.go.id" },
  { url: "https://kepriprov.go.id", label: "kepriprov.go.id" },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const router = useRouter();

  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get("url");
    if (prefill) setUrl(prefill);
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const target = url.trim();
    if (target) router.push(`/result?url=${encodeURIComponent(target)}`);
  };

  return (
    <main className={`container ${styles.main}`}>
      <div className={styles.heroGrid}>
        <section className={styles.heroSection}>
          <h1 className={styles.h1}>
            Temukan hambatan aksesibilitas di halaman web
          </h1>
          <p className={styles.description}>
            AksaraNetra memeriksa halaman publik, menguji perbaikan yang aman,
            lalu menyiapkan tampilan reader tanpa mengubah situs aslinya
          </p>
          <ul className={styles.assurances}>
            <li>Tanpa login</li>
            <li>Progress berdasarkan pemeriksaan nyata</li>
            <li>Hasil disimpan tujuh hari</li>
          </ul>
        </section>

        <section className={styles.inputSection} aria-labelledby="audit-title">
          <div className={styles.formIntro}>
            <h2 id="audit-title">Periksa halaman publik</h2>
            <p>Masukkan satu alamat untuk memulai pemeriksaan.</p>
          </div>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label htmlFor="url-input" className="label">
                Alamat halaman
              </label>
              <input
                id="url-input"
                type="url"
                className={`input ${styles.urlInput}`}
                placeholder="https://contoh.go.id/layanan"
                value={url}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setUrl(event.target.value)
                }
                required
                autoComplete="url"
              />
              <p className="hint">
                Gunakan halaman publik dengan alamat HTTP atau HTTPS
              </p>
            </div>
            <button
              type="submit"
              className={`btn btn-primary ${styles.submitBtn}`}
            >
              Mulai pemeriksaan
            </button>
          </form>
          <div className={styles.examples} aria-label="Contoh alamat">
            <span>Contoh</span>
            {EXAMPLE_SITES.map((site) => (
              <button
                key={site.url}
                type="button"
                onClick={() => {
                  setUrl(site.url);
                  document.getElementById("url-input")?.focus();
                }}
              >
                {site.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section
        className={styles.proofSection}
        aria-label="Cara hasil disiapkan"
      >
        <article>
          <h2>Diukur dua kali</h2>
          <p>Rule yang sama dijalankan sebelum dan sesudah perbaikan.</p>
        </article>
        <article>
          <h2>Perubahan dapat dibatalkan</h2>
          <p>Perbaikan yang tidak lolos pemeriksaan tidak dipertahankan.</p>
        </article>
        <article>
          <h2>Bukti tetap tersedia</h2>
          <p>Reader, screenshot, halaman hasil, dan PDF disimpan tujuh hari.</p>
        </article>
      </section>

      <p className={styles.historyLink}>
        Pernah menjalankan pemeriksaan?{" "}
        <Link href="/katalog">Buka riwayat</Link>
      </p>
    </main>
  );
}
