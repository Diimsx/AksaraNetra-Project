"use client";

import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const EXAMPLE_SITES = [
  { url: "https://sulselprov.go.id", label: "sulselprov.go.id" },
  { url: "https://kepriprov.go.id", label: "kepriprov.go.id" },
];

export default function PeriksaPage() {
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
    <main className={styles.main}>
      <div className="container">
        <section
          className={styles.formPanel}
          aria-labelledby="audit-title"
        >
          <div className={styles.formIntro}>
            <h2 id="audit-title">Periksa satu halaman</h2>
            <p>Tempel alamat halaman yang ingin diperiksa.</p>
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
                Gunakan halaman yang bisa dibuka siapa saja, tanpa perlu
                masuk akun.
              </p>
            </div>
            <button
              type="submit"
              className={`btn btn-primary ${styles.submitBtn}`}
            >
              Mulai pemeriksaan
            </button>
          </form>

          <div className={styles.examples}>
            <span className={styles.examplesLabel}>Coba contoh</span>
            <div className={styles.exampleButtons}>
              {EXAMPLE_SITES.map((site) => (
                <button
                  key={site.url}
                  type="button"
                  className={styles.exampleButton}
                  onClick={() => {
                    setUrl(site.url);
                    document.getElementById("url-input")?.focus();
                  }}
                >
                  {site.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
