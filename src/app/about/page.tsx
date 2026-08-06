import { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Tentang',
};

export default function AboutPage() {
  return (
    <main className={styles.container}>
      {/* Hero / Mission Section */}
      <section className={styles.heroSection}>
        <h1 className={styles.title}>Tentang AksaraNetra</h1>
        <p className={styles.missionText}>
          Misi kami adalah memastikan setiap layanan publik digital di Indonesia dapat diakses oleh semua warga negara tanpa hambatan. Kami membangun antarmuka yang mengutamakan kejelasan kognitif, navigasi pembaca layar, dan kontras visual tinggi, berpedoman pada standar aksesibilitas internasional tertinggi.
        </p>
      </section>

      <div className="divider" aria-hidden="true" />

      {/* What We Do Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Apa yang AksaraNetra Lakukan?</h2>
        <div className={styles.cardsContainer}>
          {/* Card 1 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <svg className={styles.icon} width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="#141b2b"/>
              </svg>
              <h3 className={styles.cardTitle}>Peningkatan Kontras & Kejelasan</h3>
            </div>
            <p className={styles.cardText}>
              Menyederhanakan tata letak dan meningkatkan rasio kontras warna secara sistematis untuk mendukung pengguna dengan penglihatan rendah. Menghapus elemen dekoratif yang tidak perlu untuk mengurangi beban kognitif.
            </p>
          </div>

          {/* Card 2 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <svg className={styles.icon} width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M21 3H3C1.89 3 1 3.89 1 5v14c0 1.11.89 2 2 2h18c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 16H3V5h18v14zm-9-9c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3zm0-8c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 14c-3.31 0-6-1.79-6-4v-1h12v1c0 2.21-2.69 4-6 4z" fill="#141b2b"/>
              </svg>
              <h3 className={styles.cardTitle}>Optimasi Pembaca Layar</h3>
            </div>
            <p className={styles.cardText}>
              Memastikan struktur HTML logis, elemen interaktif memiliki label ARIA yang jelas, dan indikator fokus yang sangat kontras untuk pengguna yang bernavigasi menggunakan keyboard atau teknologi bantu.
            </p>
          </div>
        </div>
      </section>

      <div className="divider" aria-hidden="true" />

      {/* Limitations Section */}
      <section className={styles.section}>
        <div className={styles.sectionTitleWrapper}>
          <svg className={styles.warningIcon} width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/>
          </svg>
          <h2 className={styles.sectionTitle}>Keterbatasan Saat Ini</h2>
        </div>
        <p className={styles.limitationExplanation}>
          Dalam upaya kami untuk terus mengembangkan layanan ini, kami menjunjung tinggi transparansi mengenai kemampuan sistem saat ini. Berikut adalah beberapa keterbatasan teknis yang mungkin Anda temui:
        </p>

        <div className={styles.limitationsContainer}>
          {/* Item 1 */}
          <div className={styles.limitationItem}>
            <div className={styles.limitationHeader}>
              <svg className={styles.icon} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#141b2b"/>
              </svg>
              <h4 className={styles.limitationTitle}>Tidak Mendukung Autentikasi / Login</h4>
            </div>
            <p className={styles.limitationText}>
              Saat ini sistem belum dirancang untuk memproses login pengguna, manajemen sesi, atau portal layanan pribadi yang memerlukan autentikasi keamanan tingkat lanjut.
            </p>
          </div>

          {/* Item 2 */}
          <div className={styles.limitationItem}>
            <div className={styles.limitationHeader}>
              <svg className={styles.icon} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#141b2b"/>
              </svg>
              <h4 className={styles.limitationTitle}>Kendala pada Formulir Kompleks</h4>
            </div>
            <p className={styles.limitationText}>
              Sistem mungkin mengalami kesulitan dalam menstruktur ulang formulir berlapis, formulir dengan logika bersyarat yang rumit, atau langkah-langkah transaksional yang panjang.
            </p>
          </div>

          {/* Item 3 */}
          <div className={styles.limitationItem}>
            <div className={styles.limitationHeader}>
              <svg className={styles.icon} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#141b2b"/>
              </svg>
              <h4 className={styles.limitationTitle}>Estimasi Deskripsi Gambar (AI)</h4>
            </div>
            <p className={styles.limitationText}>
              Label teks alternatif (alt-text) yang dihasilkan untuk gambar bergantung pada interpretasi kecerdasan buatan. Deskripsi ini bersifat estimasi dan mungkin tidak selalu menangkap konteks atau detail spesifik dengan akurasi 100%.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
