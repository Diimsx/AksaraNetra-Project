"use client";

import React from "react";
import styles from "./ViewportBlur.module.css";

export default function ViewportBlur() {
  return (
    <div aria-hidden="true" className="viewport-blur-wrapper">
      {/* Top Viewport Progressive Blur */}
      <div className={styles.topWrapper}>
        <div className={`${styles.layer} ${styles.topL1}`} />
        <div className={`${styles.layer} ${styles.topL2}`} />
        <div className={`${styles.layer} ${styles.topL3}`} />
        <div className={`${styles.layer} ${styles.topL4}`} />
        <div className={styles.topFade} />
      </div>

      {/* Bottom Viewport Progressive Blur */}
      <div className={styles.bottomWrapper}>
        <div className={`${styles.layer} ${styles.bottomL1}`} />
        <div className={`${styles.layer} ${styles.bottomL2}`} />
        <div className={`${styles.layer} ${styles.bottomL3}`} />
        <div className={`${styles.layer} ${styles.bottomL4}`} />
        <div className={`${styles.layer} ${styles.bottomL5}`} />
        <div className={styles.bottomFade} />
      </div>
    </div>
  );
}
