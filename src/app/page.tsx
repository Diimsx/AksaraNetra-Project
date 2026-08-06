'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const EXAMPLE_SITES = [
  { url: 'https://jakarta.go.id', title: 'Prov. DKI Jakarta', desc: 'Portal resmi Pemerintah Provinsi DKI Jakarta.' },
  { url: 'https://jabarprov.go.id', title: 'Prov. Jawa Barat', desc: 'Portal resmi Pemerintah Provinsi Jawa Barat.' },
  { url: 'https://jatengprov.go.id', title: 'Prov. Jawa Tengah', desc: 'Portal resmi Pemerintah Provinsi Jawa Tengah.' },
  { url: 'https://jogjaprov.go.id', title: 'Prov. DI Yogyakarta', desc: 'Portal resmi Pemerintah Provinsi DI Yogyakarta.' },
  { url: 'https://lampungprov.go.id', title: 'Prov. Lampung', desc: 'Portal resmi Pemerintah Provinsi Lampung.' },
  { url: 'https://bengkuluprov.go.id', title: 'Prov. Bengkulu', desc: 'Portal resmi Pemerintah Provinsi Bengkulu.' },
  { url: 'https://babelprov.go.id', title: 'Prov. Bangka Belitung', desc: 'Portal resmi Pemerintah Provinsi Kep. Bangka Belitung.' },
  { url: 'https://kepriprov.go.id', title: 'Prov. Kepulauan Riau', desc: 'Portal resmi Pemerintah Provinsi Kepulauan Riau.' },
  { url: 'https://sulselprov.go.id', title: 'Prov. Sulawesi Selatan', desc: 'Portal resmi Pemerintah Provinsi Sulawesi Selatan.' },
  { url: 'https://www.sultengprov.go.id', title: 'Prov. Sulawesi Tengah', desc: 'Portal resmi Pemerintah Provinsi Sulawesi Tengah.' },
  { url: 'https://www.sulawesitenggaraprov.go.id', title: 'Prov. Sulawesi Tenggara', desc: 'Portal resmi Pemerintah Provinsi Sulawesi Tenggara.' },
  { url: 'https://indonesia.go.id', title: 'Portal Nasional RI', desc: 'Portal informasi nasional Republik Indonesia.' },
];

export default function Home() {
  const [url, setUrl] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      router.push(`/result?url=${encodeURIComponent(url.trim())}`);
    }
  };

  const handleCardClick = (exampleUrl: string) => {
    setUrl(exampleUrl);
    // Scroll ke form input
    document.getElementById('url-input')?.focus();
  };

  return (
    <main className={`container ${styles.main}`}>
      <section className={styles.heroSection}>
        <h1 className={styles.h1}>AksaraNetra – Versi Aksesibel Halaman Publik</h1>
        <p className={styles.description}>
          Alat bantu aksesibilitas untuk membantu tunanetra mengakses layanan publik pemerintah Indonesia dengan versi yang lebih mudah dibaca dan navigasi ramah pembaca layar.
        </p>
      </section>

      <section className={styles.inputSection}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label htmlFor="url-input" className="label">
              Masukkan URL Situs Pemerintah (Halaman Publik)
            </label>
            <input 
              id="url-input"
              type="url" 
              className={`input ${styles.urlInput}`} 
              placeholder="https://..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <p className="hint">Hanya mendukung halaman publik (tanpa login).</p>
          </div>
          <button type="submit" className={`btn btn-primary ${styles.submitBtn}`}>
            Buat Versi Aksesibel
          </button>
        </form>
      </section>

      <section className={styles.examplesSection}>
        <h2 className={styles.examplesH2}>Atau pilih dari contoh situs pemerintah:</h2>
        <div className={styles.cardsGrid}>
          {EXAMPLE_SITES.map((site) => (
            <button 
              key={site.url}
              type="button" 
              className={`card ${styles.exampleCard}`} 
              onClick={() => handleCardClick(site.url)}
              aria-label={`Pilih ${site.title}: ${site.url}`}
            >
              <h3 className={styles.cardTitle}>{site.title}</h3>
              <p className={styles.cardDesc}>{site.desc}</p>
              <span className={styles.cardUrl}>{site.url.replace(/^https?:\/\//, '')}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
