"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

const EXAMPLE_SITES = [
  {
    url: "https://sulselprov.go.id",
    title: "Prov. Sulawesi Selatan",
    desc: "Baseline terukur paling stabil dan sudah diuji berulang.",
  },
  {
    url: "https://kepriprov.go.id",
    title: "Prov. Kepulauan Riau",
    desc: "Contoh audit terukur pada struktur situs yang berbeda.",
  },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const router = useRouter();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const target = url.trim();
    if (target) router.push(`/result?url=${encodeURIComponent(target)}`);
  };

  return (
    <main className={`container ${styles.main}`}>
      <section className={styles.heroSection}>
        <p className={styles.eyebrow}>Audit aksesibilitas terukur</p>
        <h1 className={styles.h1}>
          Ubah halaman publik menjadi pengalaman yang lebih mudah diakses
        </h1>
        <p className={styles.description}>
          AksaraNetra membuka halaman dengan browser sungguhan, mengauditnya
          dengan axe, menerapkan patch yang aman, lalu mengukur ulang hasilnya.
        </p>
      </section>

      <section className={styles.inputSection} aria-labelledby="audit-title">
        <div className={styles.formIntro}>
          <h2 id="audit-title">Mulai audit baru</h2>
          <p>
            Proses biasanya memerlukan satu sampai tiga menit. Kamu bisa
            meninggalkan halaman dan melanjutkannya kembali.
          </p>
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label htmlFor="url-input" className="label">
              URL halaman publik
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
              Tanpa login, hanya HTTP/HTTPS, dan harus dapat diakses publik.
            </p>
          </div>
          <button
            type="submit"
            className={`btn btn-primary ${styles.submitBtn}`}
          >
            Audit halaman
          </button>
        </form>
      </section>

      <section className={styles.proofSection} aria-label="Karakteristik audit">
        <div>
          <strong>Terukur</strong>
          <span>Sebelum dan sesudah diperiksa dengan rule yang sama.</span>
        </div>
        <div>
          <strong>Aman</strong>
          <span>URL, DNS, redirect, dan aset browser melewati guard.</span>
        </div>
        <div>
          <strong>Dapat ditinjau</strong>
          <span>Reader, laporan detail, bukti, dan PDF disimpan 7 hari.</span>
        </div>
      </section>

      <section className={styles.examplesSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Contoh stabil</p>
            <h2 className={styles.examplesH2}>
              Coba alamat yang pernah kami audit
            </h2>
          </div>
          <Link href="/katalog" className={styles.catalogLink}>
            Lihat katalog audit
          </Link>
        </div>
        <div className={styles.cardsGrid}>
          {EXAMPLE_SITES.map((site) => (
            <button
              key={site.url}
              type="button"
              className={`card ${styles.exampleCard}`}
              onClick={() => {
                setUrl(site.url);
                document.getElementById("url-input")?.focus();
              }}
            >
              <h3 className={styles.cardTitle}>{site.title}</h3>
              <p className={styles.cardDesc}>{site.desc}</p>
              <span className={styles.cardUrl}>
                {site.url.replace(/^https?:\/\//, "")}
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
