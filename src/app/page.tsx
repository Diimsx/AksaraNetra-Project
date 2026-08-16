"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

const EXAMPLE_SITES = [
  { url: "https://sulselprov.go.id", label: "sulselprov.go.id" },
  { url: "https://kepriprov.go.id", label: "kepriprov.go.id" },
];

const LANGKAH_SINGKAT = [
  {
    judul: "Halaman diperiksa",
    isi: "Alamat yang dimasukkan dibuka, lalu dicari bagian yang menyulitkan pembaca.",
  },
  {
    judul: "Perbaikan diuji",
    isi: "Hanya perbaikan yang benar benar membantu yang dipertahankan.",
  },
  {
    judul: "Tampilan baru disiapkan",
    isi: "Isi halaman ditata ulang agar lebih mudah dibaca dan dijelajahi.",
  },
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
    <main className={styles.main}>
      <div className={`${styles.heroWrap} texture-grid`}>
        <div className={`container ${styles.heroInner}`}>
          {/*
            Di layar sempit, formulir berada paling atas lewat urutan CSS,
            sedangkan urutan bacanya tetap wajar untuk pembaca layar.
          */}
          <section className={styles.formPanel} aria-labelledby="audit-title">
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
                  Gunakan halaman yang bisa dibuka siapa saja, tanpa perlu masuk
                  akun.
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

          <section className={styles.heroCopy}>
            <p className="eyebrow">Alat bantu baca halaman publik</p>
            <h1 className={styles.h1}>
              Periksa hambatannya, lalu baca versi yang lebih mudah
            </h1>
            <p className={styles.description}>
              Banyak halaman penting sulit digunakan oleh pembaca dengan
              hambatan penglihatan. AksaraNetra memeriksa halaman itu,
              memperbaiki bagian yang bisa diperbaiki, lalu menyajikan isinya
              dalam tampilan yang lebih tenang dan mudah dijelajahi.
            </p>
            <ul className={styles.assurances}>
              <li>Tidak perlu membuat akun</li>
              <li>Situs aslinya tidak diubah</li>
              <li>Hasil tersimpan tujuh hari</li>
            </ul>
          </section>
        </div>
      </div>

      <div className={`container ${styles.body}`}>
        <section className={styles.stepsSection} aria-labelledby="steps-title">
          <div className={styles.sectionIntro}>
            <h2 id="steps-title">Tiga tahap yang dilalui</h2>
            <p>
              Setiap tahap bisa dilihat hasilnya, tidak ada yang disembunyikan.
            </p>
          </div>
          <ol className={styles.steps}>
            {LANGKAH_SINGKAT.map((item, index) => (
              <li key={item.judul} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3>{item.judul}</h3>
                  <p>{item.isi}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.proofSection} aria-labelledby="proof-title">
          <h2 id="proof-title" className="sr-only">
            Yang membuat hasilnya bisa dipercaya
          </h2>
          <article>
            <h3>Diperiksa dua kali</h3>
            <p>
              Halaman dinilai sebelum dan sesudah perbaikan, dengan cara yang
              sama.
            </p>
          </article>
          <article>
            <h3>Perbaikan bisa dibatalkan</h3>
            <p>
              Perubahan yang tidak membantu tidak akan ikut dipakai pada hasil.
            </p>
          </article>
          <article>
            <h3>Hasilnya bisa dibuka ulang</h3>
            <p>
              Tampilan baru, ringkasan, dan laporannya tersimpan selama tujuh
              hari.
            </p>
          </article>
        </section>

        <section className={`${styles.closing} texture-grid`}>
          <div>
            <h2>Pernah memeriksa halaman sebelumnya?</h2>
            <p>
              Pemeriksaan yang masih tersimpan di perangkat ini bisa dibuka
              kembali tanpa memeriksa ulang.
            </p>
          </div>
          <Link href="/katalog" className="btn btn-secondary">
            Buka riwayat
          </Link>
        </section>
      </div>
    </main>
  );
}
