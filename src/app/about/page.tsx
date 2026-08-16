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
    isi: "Tombol yang hanya berupa gambar sering dibacakan tanpa nama, sehingga tidak jelas fungsinya. Bila petunjuknya cukup, tombol itu diberi nama yang sesuai.",
  },
  {
    judul: "Membuka jalan bagi pengguna papan tombol",
    isi: "Bagian yang bisa digulir dibuat agar tetap bisa dijangkau tanpa tetikus, hanya dengan papan tombol.",
  },
  {
    judul: "Menyusun ulang isi halaman",
    isi: "Isi halaman ditata menjadi satu kolom dengan urutan judul yang jelas dan warna yang lebih mudah dibedakan.",
  },
  {
    judul: "Memastikan perbaikannya benar membantu",
    isi: "Halaman dinilai sebelum dan sesudah perbaikan. Perubahan yang tidak membantu tidak dipakai.",
  },
];

const batasCakupan = [
  {
    judul: "Hanya halaman yang terbuka untuk umum",
    isi: "Halaman yang meminta akun, pembayaran, atau data pribadi tidak diperiksa.",
  },
  {
    judul: "Isi gambar tidak dikarang",
    isi: "Gambar tanpa keterangan tidak diberi keterangan tebakan, karena keterangan yang salah lebih menyesatkan daripada tidak ada.",
  },
  {
    judul: "Warna situs aslinya tidak diubah",
    isi: "Perbaikan warna dan jarak baca hanya berlaku pada tampilan yang disiapkan di sini.",
  },
  {
    judul: "Bukan pengganti pemeriksaan manusia",
    isi: "Sebagian hambatan hanya bisa dinilai oleh orang. Hasil di sini membantu peninjauan, bukan menyatakan sebuah halaman sudah layak.",
  },
];

export default function AboutPage() {
  return (
    <main className={styles.main}>
      <div className={`${styles.heroWrap} texture-grid`}>
        <header className={`container ${styles.hero}`}>
          <p className="eyebrow">Tentang AksaraNetra</p>
          <h1>
            Isi halaman penting seharusnya bisa dibaca semua orang
          </h1>
          <p className={styles.heroLead}>
            Ketika sebuah halaman dibuat tanpa memikirkan pembaca dengan hambatan
            penglihatan, isinya bisa terasa hilang meski sebenarnya ada.
            AksaraNetra memeriksa halaman seperti itu, memperbaiki bagian yang
            bisa diperbaiki dengan aman, lalu menyiapkan tampilan yang lebih
            mudah dibaca dan dijelajahi.
          </p>
        </header>
      </div>

      <div className={`container ${styles.content}`}>
        <section className={styles.section} aria-labelledby="work-title">
          <div className={styles.sectionIntro}>
            <h2 id="work-title">Yang dikerjakan</h2>
            <p>
              Perbaikan dibatasi pada hal yang bisa diperiksa hasilnya, supaya
              tidak ada perubahan yang justru menyesatkan.
            </p>
          </div>
          <ul className={styles.cardList}>
            {yangDikerjakan.map((item, index) => (
              <li key={item.judul} className={styles.card}>
                <span className={styles.cardIndex} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{item.judul}</h3>
                <p>{item.isi}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="limit-title">
          <div className={styles.sectionIntro}>
            <h2 id="limit-title">Yang tidak dilakukan</h2>
            <p>
              Batasnya disebutkan terbuka, supaya hasil pemeriksaan tidak dibaca
              lebih luas daripada yang sebenarnya diperiksa.
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

        <section className={styles.sourceNote} aria-labelledby="source-title">
          <h2 id="source-title">Hubungan dengan situs aslinya</h2>
          <p>
            Pemeriksaan dilakukan pada salinan halaman. Situs aslinya tidak
            disentuh, tidak diubah, dan tidak diwakili oleh AksaraNetra.
            AksaraNetra adalah alat bantu yang berdiri sendiri.
          </p>
        </section>

        <section className={`${styles.cta} texture-grid`}>
          <div>
            <h2>Mulai dari satu halaman</h2>
            <p>
              Tempel satu alamat, lalu lihat sendiri bagian mana yang menyulitkan
              pembaca.
            </p>
          </div>
          <div className={styles.ctaActions}>
            <Link href="/" className="btn btn-primary">
              Periksa halaman
            </Link>
            <Link href="/katalog" className="btn btn-secondary">
              Buka riwayat
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

