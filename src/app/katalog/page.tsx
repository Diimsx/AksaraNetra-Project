'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

/**
 * Halaman katalog hasil audit terukur.
 *
 * Halaman ini tidak memanggil engine. Ia hanya membaca berkas statis
 * public/data/index.json yang ditulis oleh `npm run build:data` di folder
 * engine. Pemisahan ini disengaja: engine butuh Chromium, dan Chromium tidak
 * bisa dijalankan di dalam permintaan web pada hosting gratis.
 *
 * Akibatnya angka di sini selalu berasal dari audit yang benar benar pernah
 * dijalankan, lengkap dengan waktunya, bukan dari perhitungan saat halaman
 * dibuka.
 */

interface RecentRun {
  capturedAt: string;
  beforeTotal: number | null;
  afterTotal: number | null;
}

interface Stability {
  runs: number;
  beforeMin: number | null;
  beforeMax: number | null;
  spread: number | null;
  stable: boolean;
  note: string;
}

interface DecisionCounts {
  applied: number;
  review: number;
  skipped: number;
}

interface SiteEntry {
  id: string;
  name: string;
  shortName?: string;
  sourceUrl: string;
  catalogStatus: 'verified' | 'candidate';
  baselineRuns: number;
  status: 'berhasil' | 'gagal';
  capturedAt: string;
  beforeTotal: number | null;
  afterTotal: number | null;
  reductionPercent: number | null;
  guardBlocked?: number | null;
  decisionCounts?: DecisionCounts;
  stability?: Stability;
  recentRuns?: RecentRun[];
  failure?: { code: string; message: string; stageName: string };
}

interface IndexData {
  generatedAt: string;
  engineVersion: string;
  disclaimer: string;
  scopeNote?: string;
  counts?: { total: number; succeeded: number; failed: number };
  sites: SiteEntry[];
}

const CATATAN_CAKUPAN_CADANGAN =
  'Angka penurunan di halaman ini hanya menghitung tiga hal yang diperbaiki otomatis: nama tautan, nama tombol, dan area gulir yang bisa dijangkau keyboard. Angka ini bukan penilaian aksesibilitas menyeluruh.';

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Tanggal diformat manual, bukan dengan toLocaleString.
 *
 * toLocaleString bergantung pada data lokal yang tersedia di lingkungan yang
 * menjalankannya. Server Node dan browser pengguna bisa memberi hasil berbeda
 * untuk masukan yang sama, dan React melaporkannya sebagai hydration mismatch.
 * Format manual selalu memberi hasil yang sama di kedua sisi.
 */
function waktuTerbaca(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  const jam = String(d.getHours()).padStart(2, '0');
  const menit = String(d.getMinutes()).padStart(2, '0');
  return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear() + ', ' + jam + '.' + menit;
}

export default function KatalogPage() {
  const [keadaan, setKeadaan] = useState<'memuat' | 'siap' | 'gagal'>('memuat');
  const [data, setData] = useState<IndexData | null>(null);
  const [pesanGagal, setPesanGagal] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/data/index.json', { signal: controller.signal })
      .then((tanggapan) => {
        if (!tanggapan.ok) {
          throw new Error(
            'Berkas hasil audit belum ada. Jalankan npm run build:data di folder engine terlebih dahulu.',
          );
        }
        return tanggapan.json();
      })
      .then((isi: IndexData) => {
        setData(isi);
        setKeadaan('siap');
      })
      .catch((galat: Error) => {
        if (galat.name === 'AbortError') return;
        setPesanGagal(galat.message);
        setKeadaan('gagal');
      });

    return () => controller.abort();
  }, []);

  if (keadaan === 'memuat') {
    return (
      <main className={`container ${styles.main}`}>
        <h1 className={styles.h1}>Hasil audit terukur</h1>
        <p role="status">Memuat hasil audit...</p>
      </main>
    );
  }

  if (keadaan === 'gagal' || !data) {
    return (
      <main className={`container ${styles.main}`}>
        <h1 className={styles.h1}>Hasil audit terukur</h1>
        <div className={styles.kotakKosong}>
          <h2 className={styles.judulKecil}>Data audit belum dibuat</h2>
          <p className={styles.kosongTeks} role="status">
            {pesanGagal}
          </p>
          <ol className={styles.langkahKosong}>
            <li>Buka terminal di folder proyek ini.</li>
            <li>
              Jalankan perintah berikut. Prosesnya makan beberapa menit karena
              setiap situs benar benar dibuka lalu diperiksa dua kali.
            </li>
            <li>Muat ulang halaman ini.</li>
          </ol>
          <pre className={styles.perintah}>
            <code>npm run build:data</code>
          </pre>
        </div>
        <p className={styles.tautanKembali}>
          <Link href="/">Kembali ke beranda</Link>
        </p>
      </main>
    );
  }

  const berhasil = data.sites.filter((situs) => situs.status === 'berhasil');
  const gagal = data.sites.filter((situs) => situs.status === 'gagal');

  return (
    <main className={`container ${styles.main}`}>
      <h1 className={styles.h1}>Hasil audit terukur</h1>

      <p className={styles.pengantar}>
        Setiap angka di halaman ini berasal dari audit yang benar benar pernah
        dijalankan, bukan dari perkiraan. Waktu pengambilannya ditulis apa adanya
        supaya bisa diperiksa ulang.
      </p>

      <div className={styles.pemberitahuan} role="note">
        <p>{data.scopeNote || CATATAN_CAKUPAN_CADANGAN}</p>
      </div>

      <p className={styles.keterangan}>
        Data dibuat {waktuTerbaca(data.generatedAt)} memakai engine versi{' '}
        {data.engineVersion}.
      </p>

      {berhasil.length === 0 && (
        <p role="alert">Belum ada satu pun situs yang berhasil diaudit.</p>
      )}

      <ul className={styles.daftar}>
        {berhasil.map((situs) => (
          <li key={situs.id} className={styles.kartu}>
            <h2 className={styles.judulSitus}>{situs.name}</h2>

            <p className={styles.status}>
              {situs.catalogStatus === 'verified' ? (
                <span className={styles.labelTerverifikasi}>Terverifikasi</span>
              ) : (
                <span className={styles.labelKandidat}>Kandidat</span>
              )}{' '}
              {situs.baselineRuns} baseline tercatat
            </p>

            <p className={styles.angka}>
              <strong className={styles.angkaBesar}>
                {situs.beforeTotal} ke {situs.afterTotal}
              </strong>{' '}
              node bermasalah, turun {situs.reductionPercent} persen
            </p>

            {situs.decisionCounts && (
              <p className={styles.rincian}>
                {situs.decisionCounts.applied} perbaikan diterapkan,{' '}
                {situs.decisionCounts.review} perlu diperiksa orang,{' '}
                {situs.decisionCounts.skipped} dilewati
              </p>
            )}

            {situs.stability && (
              <p className={styles.rincian}>
                {situs.stability.stable
                  ? `Stabil pada ${situs.stability.runs} audit.`
                  : `Belum stabil. ${situs.stability.note}`}
              </p>
            )}

            {situs.recentRuns && situs.recentRuns.length > 1 && (
              <details className={styles.riwayat}>
                <summary>Riwayat audit terakhir</summary>
                <ul>
                  {situs.recentRuns.map((jalan) => (
                    <li key={jalan.capturedAt}>
                      {waktuTerbaca(jalan.capturedAt)}: {jalan.beforeTotal} ke{' '}
                      {jalan.afterTotal}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <p className={styles.waktu}>Diambil {waktuTerbaca(situs.capturedAt)}</p>

            <p className={styles.tindakan}>
              <a
                className={styles.tombolUtama}
                href={`/data/${situs.id}/reader.html`}
              >
                Buka tampilan mudah dibaca {situs.shortName || situs.name}
              </a>{' '}
              <a
                href={situs.sourceUrl}
                rel="noreferrer nofollow"
                target="_blank"
              >
                Buka halaman aslinya {situs.shortName || situs.name} (tab baru)
              </a>
            </p>
          </li>
        ))}
      </ul>

      {gagal.length > 0 && (
        <section aria-labelledby="judul-gagal" className={styles.bagianGagal}>
          <h2 id="judul-gagal" className={styles.judulKecil}>
            Situs yang gagal diaudit
          </h2>

          <p>
            Kegagalan ditampilkan apa adanya. Situs yang gagal diaudit bukan
            berarti situs yang bersih.
          </p>

          <ul>
            {gagal.map((situs) => (
              <li key={situs.id}>
                <strong>{situs.name}</strong>: {situs.failure?.message} (langkah{' '}
                {situs.failure?.stageName})
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.pemberitahuanBawah}>{data.disclaimer}</p>
    </main>
  );
}
