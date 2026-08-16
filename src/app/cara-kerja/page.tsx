import { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Cara kerja",
  description:
    "Lima tahap pemeriksaan AksaraNetra, dari alamat halaman sampai tampilan yang lebih ramah akses.",
};

/**
 * Halaman cara kerja.
 *
 * Perubahan penting dari versi lama: langkah kedua dulu menyebut "meningkatkan
 * kontras warna" pada situs sumber. Itu tidak dikerjakan, jadi kalimatnya
 * diganti dengan pekerjaan yang benar benar dilakukan.
 *
 * Semua audit kini memakai satu engine terukur yang sama.
 */

const langkah = [
  {
    judul: "Alamat diperiksa lebih dulu",
    isi: "Halaman harus bisa dibuka siapa saja, dan pemilik situsnya tidak melarang pemeriksaan otomatis. Kalau salah satu syarat itu tidak terpenuhi, prosesnya berhenti di sini dan alasannya ditampilkan.",
  },
  {
    judul: "Halaman dibuka dan dinilai",
    isi: "Isi halaman diambil apa adanya, lalu dicari bagian yang biasanya menyulitkan pembaca, misalnya tombol tanpa nama atau gambar tanpa keterangan. Hasilnya menjadi catatan keadaan sebelum diperbaiki.",
  },
  {
    judul: "Hanya perbaikan yang aman dijalankan",
    isi: "Perbaikan dipasang hanya bila petunjuk di halaman sudah cukup jelas. Yang masih meragukan disimpan untuk diperiksa orang, dan yang tidak jelas dilewati. Nama yang salah lebih menyesatkan daripada tidak ada nama sama sekali.",
  },
  {
    judul: "Hasilnya dinilai ulang",
    isi: "Halaman yang sudah diperbaiki dinilai lagi dengan cara yang sama. Selisih keadaan sebelum dan sesudah dicatat apa adanya, termasuk kalau ternyata tidak ada perbaikan.",
  },
  {
    judul: "Isi disajikan dalam tampilan yang lebih mudah",
    isi: "Isi halaman disusun ulang menjadi satu kolom dengan urutan judul yang rapi dan warna yang tenang. Tautan ke halaman aslinya selalu tersedia di bagian atas dan bawah.",
  },
];

const standar = [
  {
    judul: "Mengikuti pedoman aksesibilitas internasional",
    isi: "Pemeriksaan mengikuti pedoman WCAG 2.1 tingkat A dan AA. Tingkat tertinggi tidak diklaim, karena sebagian syaratnya memang tidak bisa dinilai secara otomatis.",
  },
  {
    judul: "Huruf Atkinson Hyperlegible",
    isi: "Huruf rancangan Braille Institute yang bentuk tiap hurufnya sengaja dibuat berbeda satu sama lain, supaya lebih mudah dibedakan oleh pembaca dengan penglihatan rendah.",
  },
  {
    judul: "Diuji dengan pembaca layar sungguhan",
    isi: "Hasilnya diuji langsung memakai pembaca layar NVDA, termasuk penelusuran lewat daftar tautan, tombol, dan judul. Kami tidak mengklaim cocok dengan semua pembaca layar di semua versinya.",
  },
];

export default function CaraKerjaPage() {
  return (
    <main className={styles.container}>
      <section className={styles.hero}>
        <div className={styles.heroIsi}>
          <h1 className={styles.heroJudul}>
            Lima tahap, dari alamat halaman sampai bacaan yang lebih mudah
          </h1>
          <p className={styles.heroTeks}>
            Tidak ada tahap yang disembunyikan. Setiap keputusan yang diambil
            alat ini bisa dilihat satu per satu di halaman hasil.
          </p>
        </div>
      </section>

      <section className={styles.bagian} aria-labelledby="judul-langkah">
        <h2 id="judul-langkah" className={styles.judulBagian}>
          Urutan prosesnya
        </h2>

        <ol className={styles.daftarLangkah}>
          {langkah.map((item, i) => (
            <li key={item.judul} className={styles.langkah}>
              <span className={styles.nomor} aria-hidden="true">
                {i + 1}
              </span>
              <div className={styles.langkahIsi}>
                <h3 className={styles.langkahJudul}>{item.judul}</h3>
                <p className={styles.langkahTeks}>{item.isi}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.bagian} aria-labelledby="judul-mode">
        <h2 id="judul-mode" className={styles.judulBagian}>
          Satu cara pemeriksaan untuk semua halaman
        </h2>
        <p className={styles.pengantar}>
          Semua alamat yang masuk melewati tahap yang sama. Tidak ada jalur
          singkat yang melewatkan pengukuran.
        </p>
        <div className={`${styles.kartuMode} ${styles.kartuModeTerukur}`}>
          <h3 className={styles.modeNama}>Pemeriksaan terukur</h3>
          <p className={styles.modeKapan}>
            Untuk setiap halaman publik yang diperiksa
          </p>
          <p className={styles.modeTeks}>
            Halaman dibuka seperti pembaca biasa membukanya, lalu dinilai
            sebelum dan sesudah perbaikan. Tampilan ramah akses dan laporannya
            dibuat dari hasil yang sudah diperiksa ulang.
          </p>
        </div>
      </section>

      <section className={styles.bagian} aria-labelledby="judul-standar">
        <h2 id="judul-standar" className={styles.judulBagian}>
          Standar yang dipakai
        </h2>

        <ul className={styles.daftarStandar}>
          {standar.map((item) => (
            <li key={item.judul} className={styles.standar}>
              <h3 className={styles.standarJudul}>{item.judul}</h3>
              <p className={styles.standarTeks}>{item.isi}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.ajakan}>
        <h2 className={styles.ajakanJudul}>Coba satu halaman</h2>
        <p className={styles.ajakanTeks}>
          Tempel alamat halaman publik di beranda, atau buka kembali hasil
          pemeriksaan yang masih tersimpan di riwayat.
        </p>
        <div className={styles.ajakanTombolBaris}>
          <Link href="/" className={styles.tombolUtama}>
            Tempel alamat
          </Link>
          <Link href="/katalog" className={styles.tombolKedua}>
            Buka riwayat
          </Link>
        </div>
      </section>
    </main>
  );
}
