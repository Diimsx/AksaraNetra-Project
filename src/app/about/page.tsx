import { Metadata } from 'next';
import Link from 'next/link';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Tentang dan keterbatasan',
};

/**
 * Halaman tentang.
 *
 * Dua klaim di versi lama dihapus karena tidak sesuai dengan yang benar benar
 * dikerjakan alat ini:
 *
 * 1. "Estimasi Deskripsi Gambar (AI)". Alat ini tidak pernah mengarang alt
 *    text. Gambar tanpa alt ditandai sebagai hiasan, bukan dikarang isinya.
 * 2. "Meningkatkan rasio kontras warna" pada situs sumber. Kontras hanya
 *    dijamin di dalam tampilan bacaan yang kita susun sendiri.
 *
 * Bagian keterbatasan ditulis sebagai batas cakupan yang dipilih sadar, bukan
 * sebagai daftar kekurangan. Itu memang keadaannya: cakupan sempit dipilih
 * supaya hasilnya bisa dibuktikan.
 */

const yangDikerjakan = [
  {
    judul: 'Memberi nama pada tombol dan tautan',
    isi: 'Banyak tombol ikon di situs pemerintah hanya dibacakan sebagai "tombol" oleh pembaca layar. Alat ini menebak namanya dari petunjuk di sekitarnya, lalu mencatat setiap tebakan supaya bisa diperiksa.',
  },
  {
    judul: 'Membuka area gulir untuk keyboard',
    isi: 'Daftar yang bisa digulir sering tidak bisa dicapai dengan tombol Tab, sehingga isinya tidak terjangkau tanpa tetikus. Area seperti ini diberi akses keyboard dan penanda wilayah.',
  },
  {
    judul: 'Menyusun ulang jadi tampilan bacaan',
    isi: 'Halaman disajikan ulang satu kolom dengan urutan judul yang rapi, kontras tinggi, dan tanpa skrip. Tautan ke halaman aslinya selalu disediakan.',
  },
  {
    judul: 'Mengukur, bukan sekadar mengklaim',
    isi: 'Untuk situs di katalog, halaman diperiksa dengan axe sebelum dan sesudah perbaikan, lalu selisihnya dicatat apa adanya. Angka yang tampil berasal dari pengukuran, bukan perkiraan.',
  },
];

const batasCakupan = [
  {
    judul: 'Hanya halaman informasi publik',
    isi: 'Halaman yang butuh login, formulir panjang, pembayaran, atau data pribadi sengaja tidak disentuh. Alat otomatis tidak punya urusan di sana.',
  },
  {
    judul: 'Alt text tidak pernah dikarang',
    isi: 'Gambar tanpa keterangan tidak diberi deskripsi tebakan. Deskripsi yang salah membuat pengguna mengambil kesimpulan keliru, dan itu lebih merugikan daripada gambar yang dilewati.',
  },
  {
    judul: 'Kontras warna hanya di tampilan bacaan',
    isi: 'Warna situs sumber tidak diubah, karena mengubahnya bisa merusak arti visual yang sudah ada. Jaminan kontras berlaku pada tampilan bacaan yang kita susun sendiri.',
  },
  {
    judul: 'Situs aslinya tidak berubah sedikit pun',
    isi: 'Perbaikan terjadi pada salinan yang ditampilkan di sini. Ini alat bantu baca, bukan versi resmi dari instansi mana pun.',
  },
];

export default function AboutPage() {
  return (
    <main className={styles.container}>
      <section className={styles.hero}>
        <div className={styles.heroIsi}>
          <p className={styles.heroLabel}>Tentang</p>
          <h1 className={styles.heroJudul}>
            Halaman publik seharusnya bisa dipakai semua orang
          </h1>
          <p className={styles.heroTeks}>
            AksaraNetra mengubah halaman informasi pemerintah menjadi versi yang
            bisa dipakai dengan pembaca layar dan keyboard. Semua perubahan
            dicatat, bisa diperiksa satu per satu, dan situs aslinya tidak
            tersentuh.
          </p>
        </div>
      </section>

      <section className={styles.bagian} aria-labelledby="judul-kerja">
        <h2 id="judul-kerja" className={styles.judulBagian}>
          Apa yang alat ini kerjakan
        </h2>
        <p className={styles.pengantar}>
          Empat pekerjaan, semuanya bisa ditunjukkan hasilnya dalam bentuk angka
          atau catatan perubahan.
        </p>

        <ul className={styles.daftarKartu}>
          {yangDikerjakan.map((item, i) => (
            <li key={item.judul} className={styles.kartu}>
              <span className={styles.nomor} aria-hidden="true">{i + 1}</span>
              <h3 className={styles.kartuJudul}>{item.judul}</h3>
              <p className={styles.kartuTeks}>{item.isi}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.bagian} aria-labelledby="judul-batas">
        <h2 id="judul-batas" className={styles.judulBagian}>
          Batas yang kami pilih
        </h2>
        <p className={styles.pengantar}>
          Cakupannya sengaja dibuat sempit. Alat yang menjanjikan segalanya
          biasanya tidak bisa membuktikan apa apa, sementara cakupan sempit bisa
          diukur dan dipertanggungjawabkan.
        </p>

        <ul className={styles.daftarBatas}>
          {batasCakupan.map((item) => (
            <li key={item.judul} className={styles.batas}>
              <h3 className={styles.batasJudul}>{item.judul}</h3>
              <p className={styles.batasTeks}>{item.isi}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.ajakan}>
        <h2 className={styles.ajakanJudul}>Lihat buktinya sendiri</h2>
        <p className={styles.ajakanTeks}>
          Halaman Hasil Audit memuat angka sebelum dan sesudah untuk setiap situs
          di katalog, lengkap dengan catatan kapan diukur.
        </p>
        <Link href="/katalog" className={styles.ajakanTombol}>
          Buka hasil audit
        </Link>
      </section>
    </main>
  );
}
