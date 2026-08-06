import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Cara Kerja',
  description: 'Pelajari bagaimana AksaraNetra mengubah halaman publik menjadi versi yang lebih aksesibel untuk semua pengguna.',
};

export default function CaraKerjaPage() {
  return (
    <main className={styles.container}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <h1 id="hero-title" className={styles.heroTitle}>Cara Kerja AksaraNetra</h1>
        <p className={styles.heroSubtitle}>
          Pelajari bagaimana AksaraNetra mengubah halaman publik menjadi versi yang lebih aksesibel untuk semua pengguna.
        </p>
      </section>

      <hr className={styles.divider} aria-hidden="true" />

      <section className={styles.section} aria-labelledby="steps-title">
        <h2 id="steps-title" className={styles.sectionTitle}>Langkah-langkah Proses</h2>
        <div className={styles.stepsContainer}>
          <div className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <div className={styles.stepBadge} aria-hidden="true">1</div>
              <h3 className={styles.stepTitle}>Masukkan URL</h3>
            </div>
            <p className={styles.stepDescription}>
              Salin dan tempel URL halaman publik pemerintah yang ingin Anda akses ke kolom input di halaman utama. Sistem kami hanya mendukung halaman publik yang tidak memerlukan login.
            </p>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <div className={styles.stepBadge} aria-hidden="true">2</div>
              <h3 className={styles.stepTitle}>Analisis & Remediasi</h3>
            </div>
            <p className={styles.stepDescription}>
              Sistem kami mengambil konten halaman, menganalisis struktur HTML-nya, dan melakukan serangkaian perbaikan aksesibilitas: memperbaiki hierarki heading, menambahkan label ARIA, meningkatkan kontras warna, dan menyederhanakan navigasi.
            </p>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <div className={styles.stepBadge} aria-hidden="true">3</div>
              <h3 className={styles.stepTitle}>Tampilkan Versi Aksesibel</h3>
            </div>
            <p className={styles.stepDescription}>
              Hasil remediasi ditampilkan dalam format Reader View yang bersih dan terstruktur, dengan tipografi yang jelas, navigasi keyboard yang optimal, dan kompatibilitas penuh dengan pembaca layar seperti NVDA.
            </p>
          </div>
        </div>
      </section>

      <hr className={styles.divider} aria-hidden="true" />

      <section className={styles.section} aria-labelledby="standards-title">
        <h2 id="standards-title" className={styles.sectionTitle}>Standar yang Kami Ikuti</h2>
        <div className={styles.standardsContainer}>
          <div className={styles.standardCard}>
            <h3 className={styles.standardTitle}>WCAG 2.1 AAA</h3>
            <p className={styles.standardDescription}>
              Kami mengikuti panduan Web Content Accessibility Guidelines level AAA, standar tertinggi untuk aksesibilitas konten web yang ditetapkan oleh W3C.
            </p>
          </div>
          <div className={styles.standardCard}>
            <h3 className={styles.standardTitle}>Atkinson Hyperlegible</h3>
            <p className={styles.standardDescription}>
              Font yang dirancang khusus oleh Braille Institute untuk meningkatkan keterbacaan bagi pengguna dengan gangguan penglihatan, digunakan di seluruh antarmuka kami.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
