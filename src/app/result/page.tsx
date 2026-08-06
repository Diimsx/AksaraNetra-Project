'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

interface ProcessResult {
  title: string;
  description: string;
  content: string;
}

function ResultPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlParam = searchParams.get('url');

  const [state, setState] = useState<'processing' | 'result' | 'error'>('processing');
  const [data, setData] = useState<ProcessResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!urlParam) {
      setErrorMessage('Tidak ada URL yang diberikan.');
      setState('error');
      return;
    }

    const controller = new AbortController();

    const processUrl = async () => {
      try {
        const response = await fetch('/api/process?url=' + encodeURIComponent(urlParam), {
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const msg = errorData?.error || `Server merespons dengan status ${response.status}`;
          setErrorMessage(msg);
          setState('error');
          return;
        }

        const resultData: ProcessResult = await response.json();
        setData(resultData);
        setState('result');
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('Processing error:', error);
        setErrorMessage(error.message || 'Terjadi kesalahan yang tidak terduga.');
        setState('error');
      }
    };

    processUrl();

    return () => controller.abort();
  }, [urlParam]);

  if (state === 'processing') {
    return (
      <div className={styles.processingContainer}>
        <div className={styles.spinner} role="status" aria-label="Memproses..."></div>
        <h1 className={styles.processingTitle}>Memvalidasi URL...</h1>
        <p className={styles.processingText}>Mohon tunggu, proses ini membutuhkan waktu beberapa saat.</p>
        <button 
          onClick={() => router.push('/')}
          className={styles.cancelButton}
        >
          Batalkan
        </button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon} aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
          </svg>
        </div>
        <h1 className={styles.errorTitle}>Ups! Terjadi Kendala.</h1>
        <p className={styles.errorExplanation}>
          {errorMessage || 'Maaf, kami tidak dapat mengakses halaman tersebut. Ini mungkin karena URL tidak valid, situs membatasi akses, atau halaman memerlukan kata sandi.'}
        </p>
        <div className={styles.errorDivider}></div>
        <p className={styles.errorSuggestion}>
          Silakan periksa kembali URL Anda atau coba situs publik lainnya.
        </p>
        <Link href="/" className={styles.errorButton}>
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.resultContainer}>
      <div className={styles.actionBar}>
        <div className={styles.actionLeft}>
          <svg className={styles.warningIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M1 21H23L12 2L1 21ZM13 18H11V16H13V18ZM13 14H11V10H13V14Z" fill="currentColor"/>
          </svg>
          <p className={styles.disclaimer}>
            Ini adalah versi tidak resmi yang dihasilkan AksaraNetra. Bukan situs resmi pemerintah.
          </p>
        </div>
        <div className={styles.actionRight}>
          <Link href="/" className={styles.backButton}>
            Kembali ke Beranda
          </Link>
          <button className={styles.downloadButton}>
            Unduh Laporan
          </button>
        </div>
      </div>

      <main className={styles.articleWrapper}>
        <article>
          <header>
            <h1 className={styles.articleTitle}>{data?.title}</h1>
            <p className={styles.articleDescription}>{data?.description}</p>
          </header>
          
          <div 
            className={styles.articleContent}
            dangerouslySetInnerHTML={{ __html: data?.content || '' }}
          />
        </article>

        <section className={styles.feedbackSection} aria-labelledby="feedback-heading">
          <h2 id="feedback-heading" className={styles.feedbackTitle}>Umpan Balik Aksesibilitas</h2>
          <form className={styles.feedbackForm} onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="feedback" className={styles.feedbackLabel}>
              Berikan masukan Anda tentang aksesibilitas halaman ini
            </label>
            <textarea 
              id="feedback" 
              className={styles.feedbackTextarea} 
              placeholder="Ketik masukan Anda di sini..."
              aria-describedby="feedback-hint"
            ></textarea>
            <p id="feedback-hint" className={styles.feedbackHint}>
              Masukan Anda membantu kami meningkatkan kualitas remediasi.
            </p>
            <button type="submit" className={styles.feedbackSubmit}>
              Kirim Masukan
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div className={styles.processingContainer}>
        <div className={styles.spinner} role="status" aria-label="Memuat..."></div>
      </div>
    }>
      <ResultPageContent />
    </Suspense>
  );
}
