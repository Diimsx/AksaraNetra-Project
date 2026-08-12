import { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Cara kerja",
  description:
    "Lima tahap pemeriksaan AksaraNetra, dari validasi alamat sampai tampilan reader dan hasil terukur.",
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
    judul: "Alamat diperiksa dulu",
    isi: "Alamat harus http atau https, bukan alamat jaringan lokal, dan tidak ditolak oleh berkas robots.txt situs tersebut. Kalau salah satu syarat tidak terpenuhi, prosesnya berhenti di sini dan alasannya ditampilkan.",
  },
  {
    judul: "Halaman diambil dan diperiksa",
    isi: "Isi halaman diambil, lalu diperiksa dengan axe memakai aturan WCAG 2.1 tingkat A dan AA. Hasil pemeriksaan ini menjadi angka awal, yaitu keadaan sebelum diperbaiki.",
  },
  {
    judul: "Perbaikan disaring lewat tingkat keyakinan",
    isi: "Setiap usulan perbaikan diberi nilai keyakinan. Nilai 0,80 ke atas langsung dipasang, 0,60 sampai 0,79 disimpan untuk diperiksa manusia, dan di bawah itu dilewati. Nama yang salah lebih berbahaya daripada tidak ada nama sama sekali.",
  },
  {
    judul: "Hasilnya diukur ulang",
    isi: "Halaman yang sudah diperbaiki diperiksa lagi dengan aturan yang sama. Selisih antara angka awal dan angka akhir dicatat apa adanya, termasuk kalau ternyata tidak ada perbaikan.",
  },
  {
    judul: "Disajikan sebagai tampilan bacaan",
    isi: "Isi halaman disusun ulang menjadi satu kolom dengan urutan judul yang rapi, kontras tinggi, dan tanpa skrip. Tautan ke halaman aslinya selalu ada di bagian atas dan bawah.",
  },
];

const standar = [
  {
    judul: "WCAG 2.1 tingkat A dan AA",
    isi: "Pemeriksaan otomatis memakai aturan axe untuk tingkat A dan AA. Tingkat AAA tidak diklaim untuk situs sumber, karena sebagian syaratnya memang tidak bisa diperiksa oleh mesin.",
  },
  {
    judul: "Atkinson Hyperlegible",
    isi: "Huruf rancangan Braille Institute yang bentuk tiap karakternya sengaja dibuat berbeda satu sama lain, supaya lebih mudah dibedakan oleh pembaca dengan penglihatan rendah.",
  },
  {
    judul: "Diuji dengan pembaca layar sungguhan",
    isi: "Hasilnya diuji manual memakai NVDA, termasuk penelusuran lewat daftar tautan, tombol, dan judul. Kami tidak mengklaim cocok dengan semua pembaca layar di semua versinya.",
  },
];

export default function CaraKerjaPage() {
  return (
    <main className={styles.container}>
      <section className={styles.hero}>
        <div className={styles.heroIsi}>
          <h1 className={styles.heroJudul}>
            Lima langkah, dari alamat sampai halaman yang bisa dibaca
          </h1>
          <p className={styles.heroTeks}>
            Tidak ada langkah yang tersembunyi. Setiap keputusan yang diambil
            alat ini bisa kamu lihat satu per satu di halaman hasil.
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
          Satu engine, satu standar hasil
        </h2>
        <p className={styles.pengantar}>
          Alamat dari beranda dan situs katalog kini melewati pipeline terukur
          yang sama. Tidak ada lagi jalur cepat tanpa pengukuran.
        </p>
        <div className={`${styles.kartuMode} ${styles.kartuModeTerukur}`}>
          <h3 className={styles.modeNama}>Audit terukur</h3>
          <p className={styles.modeKapan}>
            Untuk setiap halaman publik yang diajukan
          </p>
          <p className={styles.modeTeks}>
            Browser sungguhan memuat halaman, axe mengukur sebelum dan sesudah,
            lalu reader dan PDF dibuat dari DOM yang sudah diverifikasi.
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
        <h2 className={styles.ajakanJudul}>Coba langsung</h2>
        <p className={styles.ajakanTeks}>
          Tempel alamat halaman publik di beranda, atau lihat hasil pengukuran
          pemeriksaan yang masih tersedia di riwayat.
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
