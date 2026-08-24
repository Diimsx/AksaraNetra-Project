"use client";

import React from "react";
import styles from "./BlueGlow.module.css";

interface BlueGlowProps {
  /**
   * 'hero': Luminous multi-tone central cloud (primary blue + cyan + indigo)
   * 'ambient': Soft asymmetric side clouds that drift gently
   * 'center': Subtle centered atmospheric glow
   * 'global': Fixed viewport background glow across all pages
   */
  variant?: "hero" | "ambient" | "center" | "global";
  className?: string;
}

export default function BlueGlow({
  variant = "hero",
  className = "",
}: BlueGlowProps) {
  if (variant === "global") {
    return (
      <div
        className={`${styles.glowGlobalContainer} ${className}`}
        aria-hidden="true"
      >
        <div className={styles.globalTopCenter} />
        <div className={styles.globalMidRight} />
        <div className={styles.globalBottomLeft} />
      </div>
    );
  }

  return (
    <div
      className={`${styles.glowContainer} ${className}`}
      aria-hidden="true"
    >
      {variant === "hero" && (
        <>
          {/* Cahaya Biru Utama di Tengah */}
          <div className={styles.heroGlowMain} />
          {/* Cahaya Cyan (Biru Muda) di Kiri Atas */}
          <div className={styles.heroGlowCyan} />
          {/* Cahaya Indigo (Biru Gelap) di Kanan Bawah */}
          <div className={styles.heroGlowIndigo} />
          {/* Aksen Luminous Center */}
          <div className={styles.heroGlowCenter} />
        </>
      )}

      {variant === "ambient" && (
        <>
          {/* Awan Cyan di Sisi Kiri */}
          <div className={styles.ambientBlobLeft} />
          {/* Awan Biru/Indigo di Sisi Kanan */}
          <div className={styles.ambientBlobRight} />
        </>
      )}

      {variant === "center" && (
        <>
          <div className={styles.heroGlowMain} />
          <div className={styles.heroGlowCenter} />
        </>
      )}
    </div>
  );
}
