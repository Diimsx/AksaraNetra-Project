import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Tentang",
  description:
    "Penjelasan tentang pemeriksaan aksesibilitas AksaraNetra dan batas cakupannya.",
};

const yangDikerjakan = [
  {
    judul: "Memberi nama pada tombol dan tautan",
    isi: "Tombol ikon yang tidak memiliki nama dapat diberi label berdasarkan petunjuk di sekitarnya. Setiap perubahan tetap dicatat agar dapat ditinjau.",
  },
  {
    judul: "Membuka area gulir untuk keyboard",
    isi: "Area yang dapat digulir dibuat dapat dicapai dengan keyboard dan diberi penanda yang membantu navigasi.",
  },
  {
    judul: "Menyiapkan tampilan reader",
    isi: "Konten disusun dalam satu kolom dengan urutan judul yang lebih jelas, kontras tinggi, dan tautan ke halaman asli.",
  },
  {
    judul: "Memeriksa hasil perbaikan",
    isi: "Halaman diuji sebelum dan sesudah perubahan dengan aturan yang sama. Hanya perbaikan yang lolos pemeriksaan yang dipertahankan.",
  },
];

const batasCakupan = [
  {
    judul: "Hanya halaman informasi publik",
    isi: "Halaman yang memerlukan login, pembayaran, atau data pribadi tidak diperiksa.",
  },
  {
    judul: "Deskripsi gambar tidak dibuat otomatis",
    isi: "Gambar tanpa keterangan tidak diberi deskripsi tebakan yang berisiko menyesatkan.",
  },
  {
    judul: "Kontras situs sumber tidak diubah",
    isi: "Kontras tinggi diterapkan pada tampilan reader, bukan pada situs sumber.",
  },
  {
    judul: "Situs asli tetap sama",
    isi: "Perbaikan diterapkan pada salinan pemeriksaan. AksaraNetra tidak mengubah situs resmi terkait.",
  },
];

export default function AboutPage() {
  return (
    <main className={styles.container}>
      <header className={styles.hero}>
        <h1>Apa yang dilakukan AksaraNetra</h1>
        <p>
          AksaraNetra memeriksa hambatan aksesibilitas pada halaman publik,
          menguji perbaikan yang aman, dan menyiapkan tampilan reader. Hasilnya
          membantu peninjauan, bukan sertifikasi aksesibilitas.
        </p>
      </header>

      <section className={styles.section} aria-labelledby="work-title">
        <div className={styles.sectionIntro}>
          <h2 id="work-title">Bagian yang diperiksa</h2>
          <p>
            Pemeriksaan difokuskan pada perubahan yang dapat diukur dan ditinjau
            kembali.
          </p>
        </div>
        <ul className={styles.cardList}>
          {yangDikerjakan.map((item) => (
            <li key={item.judul} className={styles.card}>
              <h3>{item.judul}</h3>
              <p>{item.isi}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="limit-title">
        <div className={styles.sectionIntro}>
          <h2 id="limit-title">Batas pemeriksaan</h2>
          <p>
            Cakupan dibuat terbatas agar hasil tidak memberikan klaim yang lebih
            luas dari pemeriksaan yang dilakukan.
          </p>
        </div>
        <ul className={styles.limitList}>
          {batasCakupan.map((item) => (
            <li key={item.judul} className={styles.limitCard}>
              <h3>{item.judul}</h3>
              <p>{item.isi}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.cta}>
        <div>
          <h2>Lihat hasil pemeriksaan</h2>
          <p>
            Riwayat menyimpan hasil yang masih tersedia pada perangkat ini
            selama tujuh hari.
          </p>
        </div>
        <Link href="/katalog" className="btn btn-primary">
          Buka riwayat
        </Link>
      </section>
    </main>
  );
}
