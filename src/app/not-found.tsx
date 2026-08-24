import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.main}>
      <div className={styles.blobWrap}>
        <svg
          viewBox="0 0 220 220"
          width="220"
          height="220"
          aria-hidden="true"
          className={styles.blobSvg}
        >
          <path
            d="M110 8 C150 4, 195 30, 208 72 C221 114, 206 162, 168 190 C130 218, 72 216, 38 184 C4 152, -6 96, 18 56 C42 16, 70 12, 110 8 Z"
            fill="url(#blobGradient404)"
          />
          <defs>
            <linearGradient
              id="blobGradient404"
              x1="0"
              y1="0"
              x2="220"
              y2="220"
            >
              <stop offset="0%" stopColor="var(--color-primary-button)" />
              <stop offset="100%" stopColor="var(--color-primary-dark)" />
            </linearGradient>
          </defs>
        </svg>
        <span className={styles.blobAngka}>404</span>
      </div>

      <div className={styles.divider} aria-hidden="true" />

      <div className={styles.teksWrap}>
        <h1>Halaman ini tidak ditemukan</h1>
        <p>
          Alamat yang dituju mungkin sudah berpindah atau tidak pernah ada.
          Anda bisa kembali ke beranda untuk memeriksa halaman lain.
        </p>
        <Link href="/" className="btn btn-primary">
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
