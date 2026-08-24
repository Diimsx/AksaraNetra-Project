"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { useUngkap } from "@/lib/use-ungkap";
import {
  Stage1,
  Stage2,
  Stage3,
  Stage4,
  Stage5,
} from "@/components/StageVisualizations";
import {
  Feature1,
  Feature2,
  Feature3,
  Feature4,
} from "@/components/FeatureVisualizations";
import {
  Limitation1,
  Limitation2,
  Limitation3,
  Limitation4,
} from "@/components/LimitationVisualizations";


const TAHAP_VISUALS = [Stage1, Stage2, Stage3, Stage4, Stage5];
const FEATURE_VISUALS = [Feature1, Feature2, Feature3, Feature4];
const LIMITATION_VISUALS = [
  Limitation1,
  Limitation2,
  Limitation3,
  Limitation4,
];

const LANGKAH = [
  {
    judul: "Alamat diperiksa lebih dulu",
    isi: "Halaman harus bisa dibuka siapa saja, dan pemilik situsnya tidak melarang pemeriksaan otomatis. Kalau salah satu syarat itu tidak terpenuhi, prosesnya berhenti di sini dan alasannya ditampilkan.",
  },
  {
    judul: "Halaman dibuka dan dinilai",
    isi: "Isi halaman diambil apa adanya, lalu dicari bagian yang biasanya menyulitkan pembaca, misalnya tombol tanpa nama atau gambar tanpa keterangan.",
  },
  {
    judul: "Hanya perbaikan yang aman dijalankan",
    isi: "Perbaikan dipasang hanya bila petunjuk di halaman sudah cukup jelas. Yang masih meragukan disimpan untuk diperiksa orang.",
  },
  {
    judul: "Hasilnya dinilai ulang",
    isi: "Halaman yang sudah diperbaiki dinilai lagi dengan cara yang sama. Selisih keadaan sebelum dan sesudah dicatat apa adanya.",
  },
  {
    judul: "Isi disajikan dalam tampilan yang lebih mudah",
    isi: "Isi halaman disusun ulang menjadi satu kolom dengan urutan judul yang rapi. Tautan ke halaman aslinya selalu tersedia.",
  },
];

const STANDAR = [
  {
    judul: "Pedoman aksesibilitas internasional",
    isi: "Pemeriksaan mengikuti pedoman WCAG 2.1 tingkat A dan AA. Tingkat tertinggi tidak diklaim, karena sebagian syaratnya memang tidak bisa dinilai otomatis.",
    logo: "/logo-w3c.png",
    altLogo: "Logo World Wide Web Consortium (W3C)",
  },
  {
    judul: "Huruf yang mudah dipindai",
    isi: "Halaman disusun dengan huruf yang jelas bentuknya dan ukuran yang cukup besar, supaya lebih nyaman dipindai baik oleh mata maupun pembaca layar.",
    logo: "/logo-pembesar.png",
    altLogo: "Ikon pemindaian teks dan huruf",
  },
  {
    judul: "Diuji dengan pembaca layar sungguhan",
    isi: "Hasilnya diuji langsung memakai pembaca layar NVDA, termasuk penelusuran lewat daftar tautan, tombol, dan judul.",
    logo: "/logo-nvda.png",
    altLogo: "Logo pembaca layar NVDA",
  },
];

const YANG_DIKERJAKAN = [
  {
    judul: "Memberi nama pada tombol dan tautan",
    isi: "Tombol yang hanya berupa gambar sering dibacakan tanpa nama. Bila petunjuknya cukup, tombol itu diberi nama yang sesuai.",
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

const BATAS_CAKUPAN = [
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

const SLIDES = [
  {
    src: "/preview-ringkasan.png",
    alt: "Ringkasan hasil pemeriksaan aksesibilitas situs Pemerintah Provinsi Sulawesi Selatan",
  },
  {
    src: "/preview-perbandingan.png",
    alt: "Perbandingan jumlah hambatan sebelum dan sesudah perbaikan, berkurang 84,62%",
  },
  {
    src: "/preview-pemeriksaan.png",
    alt: "Rincian pemeriksaan ulang setelah perbaikan: 11 berhasil diperbaiki, 0 dibatalkan, 2 belum dapat diperbaiki",
  },
];

// Replikasi slide agar selalu mengisi layar secara berkesinambungan tanpa henti
const REPEAT_COUNT = 4;
const ALL_SLIDES = Array.from({ length: REPEAT_COUNT }).flatMap(() => SLIDES);

function HeroCarousel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const lastXRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const singleSetWidthRef = useRef<number>(0);
  const [isGrabbing, setIsGrabbing] = useState(false);

  // Ukur lebar satu set (3 slide beserta gap-nya)
  const measure = useCallback(() => {
    if (!trackRef.current) return;
    singleSetWidthRef.current = trackRef.current.scrollWidth / REPEAT_COUNT;
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    let animId: number;
    const baseSpeed = 0.65; // Kecepatan gerak otomatis per frame (piksel)

    const loop = () => {
      if (singleSetWidthRef.current > 0) {
        if (!isDraggingRef.current) {
          // Efek inersia setelah digeser pengguna
          if (Math.abs(velocityRef.current) > 0.05) {
            offsetRef.current += velocityRef.current;
            velocityRef.current *= 0.92;
          } else {
            velocityRef.current = 0;
            offsetRef.current -= baseSpeed;
          }

          // Looping mulus tak terbatas (tanpa pernah melompat/kembali ke kiri)
          while (offsetRef.current <= -singleSetWidthRef.current) {
            offsetRef.current += singleSetWidthRef.current;
          }
          while (offsetRef.current > 0) {
            offsetRef.current -= singleSetWidthRef.current;
          }

          if (trackRef.current) {
            trackRef.current.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
          }
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true;
    setIsGrabbing(true);
    lastXRef.current = e.clientX;
    velocityRef.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    velocityRef.current = dx;
    offsetRef.current += dx;

    if (singleSetWidthRef.current > 0) {
      while (offsetRef.current <= -singleSetWidthRef.current) {
        offsetRef.current += singleSetWidthRef.current;
      }
      while (offsetRef.current > 0) {
        offsetRef.current -= singleSetWidthRef.current;
      }
    }

    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsGrabbing(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  return (
    <div
      className={`${styles.carouselWrap} ungkap`}
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ cursor: isGrabbing ? "grabbing" : "grab" }}
    >
      <div className={styles.carouselTrack} ref={trackRef}>
        {ALL_SLIDES.map((slide, i) => (
          <div key={`${slide.src}-${i}`} className={styles.carouselCard}>
            <div className={styles.carouselCardInner}>
              <img
                src={slide.src}
                alt={slide.alt}
                className={styles.carouselImg}
                draggable={false}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  useUngkap();

  return (
    <main className={styles.main}>
      {/* ============ HERO ============ */}
      <div id="hero-utama" className={styles.heroWrap}>
        <div className={`container ${styles.heroInner}`}>
          <span className={`mono-pill ${styles.heroPill}`}>
            <span className={styles.pillDot} aria-hidden="true" />
            Alat bantu baca halaman publik
            <span className={styles.pillArrow} aria-hidden="true">›</span>
          </span>
          <h1 className={styles.h1}>
            Periksa hambatannya, lalu baca versi yang{" "}
            <span className={styles.h1Accent}>lebih mudah.</span>
          </h1>
          <p className={styles.description}>
            AksaraNetra memeriksa halaman publik, memperbaiki bagian yang bisa
            diperbaiki, lalu menyajikan isinya dalam tampilan yang lebih
            mudah dibaca dan dijelajahi.
          </p>
          <div className={styles.heroCtaRow}>
            <Link href="/periksa" className="btn btn-primary">
              Mulai pemeriksaan
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <a href="#cara-kerja" className="btn btn-secondary">
              Lihat cara kerja
            </a>
          </div>
        </div>
        {/* Screenshot carousel di bawah hero */}
        <HeroCarousel />
      </div>

      {/* ============ CARA KERJA ============ */}
      <section
        id="cara-kerja"
        className={styles.sectionWrap}
        aria-labelledby="cara-kerja-title"
      >
        <div className="container">
          <div className={`${styles.sectionIntro} ungkap`}>
            <span className={`mono-pill ${styles.sectionPill}`}>
              <span className={styles.pillDot} aria-hidden="true" />
              Cara kerja
              <span className={styles.pillArrow} aria-hidden="true">›</span>
            </span>
            <h2 id="cara-kerja-title">
              Lima tahap, dari alamat halaman sampai bacaan yang lebih mudah
            </h2>
            <p>
              Tidak ada tahap yang disembunyikan. Setiap keputusan yang
              diambil alat ini bisa dilihat satu per satu di halaman hasil.
            </p>
          </div>

          <ol className={`${styles.daftarLangkah} ungkap`}>
            {LANGKAH.map((item, i) => {
              const StageComponent = TAHAP_VISUALS[i];
              return (
                <li key={item.judul} className={styles.langkah}>
                  <div className={styles.langkahHeader}>
                    <span className={styles.nomor} aria-hidden="true">
                      {i + 1}
                    </span>
                    <div className={styles.langkahText}>
                      <h3>{item.judul}</h3>
                      <p>{item.isi}</p>
                    </div>
                  </div>
                  <div className={styles.langkahVisual}>
                    {StageComponent && <StageComponent />}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className={`${styles.standarGrid} ungkap`}>
            <div className={styles.standarIntro}>
              <h3>Standar yang dipakai</h3>
              <p>
                Semua alamat yang masuk melewati tahap yang sama. Tidak ada
                jalur singkat yang melewatkan pengukuran.
              </p>
            </div>
            <ul className={styles.standarList}>
              {STANDAR.map((item) => (
                <li key={item.judul} className={styles.standarCard}>
                  <div className={styles.standarHeader}>
                    {item.logo && (
                      <div className={styles.standarLogoWrap}>
                        <img
                          src={item.logo}
                          alt={item.altLogo || ""}
                          className={styles.standarLogo}
                        />
                      </div>
                    )}
                    <h4>{item.judul}</h4>
                  </div>
                  <p>{item.isi}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============ TENTANG ============ */}
      <section
        id="tentang"
        className={`${styles.sectionWrap} ${styles.sectionAlt}`}
        aria-labelledby="tentang-title"
      >
        <div className="container">
          <div className={`${styles.sectionIntro} ungkap`}>
            <span className={`mono-pill ${styles.sectionPill}`}>
              <span className={styles.pillDot} aria-hidden="true" />
              Tentang AksaraNetra
              <span className={styles.pillArrow} aria-hidden="true">›</span>
            </span>
            <h2 id="tentang-title">
              Isi halaman penting seharusnya bisa dibaca semua orang
            </h2>
            <p>
              Ketika sebuah halaman dibuat tanpa memikirkan pembaca dengan
              hambatan penglihatan, isinya bisa terasa hilang meski
              sebenarnya ada.
            </p>
          </div>

          <div className={`${styles.aboutSections} ungkap`}>
            {/* Section: Yang dikerjakan */}
            <div className={styles.aboutSectionBlock}>
              <div className={styles.aboutGroupHeader}>
                <h3 className={styles.aboutGroupTitle}>
                  <span className={styles.titleBadgeCheck} aria-hidden="true">
                    ✓
                  </span>
                  Yang dikerjakan
                </h3>
                <p className={styles.aboutGroupDesc}>
                  Perbaikan dibatasi pada hal yang bisa diperiksa hasilnya,
                  supaya tidak ada perubahan yang justru menyesatkan.
                </p>
              </div>
              <ul className={styles.aboutGridCards}>
                {YANG_DIKERJAKAN.map((item, index) => {
                  const FeatureComponent = FEATURE_VISUALS[index];
                  return (
                    <li key={item.judul} className={styles.aboutCard}>
                      <div className={styles.aboutCardHeader}>
                        <div className={styles.aboutCardBody}>
                          <h4>{item.judul}</h4>
                          <p>{item.isi}</p>
                        </div>
                      </div>
                      {FeatureComponent && (
                        <div className={styles.aboutVisualWrap}>
                          <FeatureComponent />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Section: Yang tidak dilakukan */}
            <div className={styles.aboutSectionBlock}>
              <div className={styles.aboutGroupHeader}>
                <h3 className={styles.aboutGroupTitle}>
                  <span className={styles.titleBadgeMuted} aria-hidden="true">
                    ✕
                  </span>
                  Yang tidak dilakukan
                </h3>
                <p className={styles.aboutGroupDesc}>
                  Batasnya disebutkan terbuka, supaya hasil pemeriksaan tidak
                  dibaca lebih luas daripada yang sebenarnya diperiksa.
                </p>
              </div>
              <ul className={styles.aboutGridCards}>
                {BATAS_CAKUPAN.map((item, index) => {
                  const LimitationComponent = LIMITATION_VISUALS[index];
                  return (
                    <li key={item.judul} className={styles.aboutCardMuted}>
                      <div className={styles.aboutCardHeader}>
                        <div className={styles.aboutCardBody}>
                          <h4>{item.judul}</h4>
                          <p>{item.isi}</p>
                        </div>
                      </div>
                      {LimitationComponent && (
                        <div className={styles.aboutVisualWrapMuted}>
                          <LimitationComponent />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className={`${styles.sourceNote} ungkap`}>
            <h3>Hubungan dengan situs aslinya</h3>
            <p>
              Pemeriksaan dilakukan pada salinan halaman. Situs aslinya tidak
              disentuh, tidak diubah, dan tidak diwakili oleh AksaraNetra.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
