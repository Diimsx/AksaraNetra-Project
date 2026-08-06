'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

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
        <div className={styles.cardsRow}>
          <button 
            type="button" 
            className={`card ${styles.exampleCard}`} 
            onClick={() => handleCardClick('https://indonesia.go.id')}
          >
            <h3 className={styles.cardTitle}>Portal Nasional</h3>
            <p className={styles.cardDesc}>Informasi umum dan layanan terpadu.</p>
          </button>
          <button 
            type="button" 
            className={`card ${styles.exampleCard}`} 
            onClick={() => handleCardClick('https://dukcapil.kemendagri.go.id')}
          >
            <h3 className={styles.cardTitle}>Dinas Kependudukan</h3>
            <p className={styles.cardDesc}>Layanan KTP, KK, dan catatan sipil.</p>
          </button>
          <button 
            type="button" 
            className={`card ${styles.exampleCard}`} 
            onClick={() => handleCardClick('https://sehatnegeriku.kemkes.go.id')}
          >
            <h3 className={styles.cardTitle}>Layanan Kesehatan</h3>
            <p className={styles.cardDesc}>Informasi dan layanan kesehatan publik.</p>
          </button>
        </div>
      </section>
    </main>
  );
}
