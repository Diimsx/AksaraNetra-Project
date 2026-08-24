"use client";

import { motion } from "framer-motion";
import {
  Lock,
  CreditCard,
  FileText,
  Ban,
  CheckCircle2,
  Image as ImageIcon,
  Bot,
  X,
  Palette,
  Globe,
  SearchCode,
  UserCheck,
} from "lucide-react";
import styles from "./LimitationVisualizations.module.css";

export function Limitation1() {
  const items = [
    { id: 1, icon: Lock, label: "Halaman Login", status: "blocked" as const },
    { id: 2, icon: CreditCard, label: "Pembayaran", status: "blocked" as const },
    { id: 3, icon: FileText, label: "Artikel Publik", status: "allowed" as const },
  ];

  return (
    <motion.div
      key="limit-1"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={styles.l1Wrap}
    >
      {items.map((item, i) => (
        <motion.div
          key={item.id}
          className={[
            styles.l1Item,
            item.status === "blocked" ? styles.l1ItemBlocked : styles.l1ItemAllowed,
          ].join(" ")}
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false }}
          transition={{ delay: i * 0.2 }}
        >
          <div className={styles.l1Left}>
            <div
              className={[
                styles.l1IconWrap,
                item.status === "blocked" ? styles.l1IconBlocked : styles.l1IconAllowed,
              ].join(" ")}
            >
              <item.icon className={styles.l1Icon} />
            </div>
            <span
              className={[
                styles.l1Label,
                item.status === "blocked" ? styles.l1LabelBlocked : styles.l1LabelAllowed,
              ].join(" ")}
            >
              {item.label}
            </span>
          </div>

          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: false }}
            transition={{ delay: i * 0.2 + 0.3, type: "spring" }}
          >
            {item.status === "blocked" ? (
              <div className={styles.l1BadgeBlocked}>
                <Ban className={styles.l1BadgeIcon} /> Skip
              </div>
            ) : (
              <div className={styles.l1BadgeAllowed}>
                <CheckCircle2 className={styles.l1BadgeIcon} /> Proses
              </div>
            )}
          </motion.div>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function Limitation2() {
  return (
    <motion.div
      key="limit-2"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={styles.l2Wrap}
    >
      <div className={styles.l2Card}>
        <ImageIcon className={styles.l2ImageIcon} />

        {/* AI trying to guess */}
        <motion.div
          className={styles.l2AiBubble}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: false }}
          transition={{ delay: 0.6 }}
        >
          <Bot className={styles.l2BotIcon} />
          <span>alt=&quot;Mungkin<br />gambar kucing?&quot;</span>

          {/* Rejection Cross */}
          <motion.div
            className={styles.l2RejectOverlay}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false }}
            transition={{ delay: 1.5 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: false }}
              transition={{ delay: 1.6, type: "spring" }}
            >
              <X className={styles.l2RejectX} strokeWidth={3} />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        className={styles.l2NoteBox}
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false }}
        transition={{ delay: 2.2 }}
      >
        Dibiarkan kosong daripada memberikan informasi keliru.
      </motion.div>
    </motion.div>
  );
}

export function Limitation3() {
  return (
    <motion.div
      key="limit-3"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={styles.l3Wrap}
    >
      {/* Original Site */}
      <div className={styles.l3Col}>
        <div className={styles.l3HeaderOriginal}>
          <Globe className={styles.l3SmallIcon} /> Website Asli
        </div>
        <div className={styles.l3WindowOriginal}>
          <div className={styles.l3TrafficLights}>
            <div className={styles.l3DotRed} />
            <div className={styles.l3DotAmber} />
            <div className={styles.l3DotGreen} />
          </div>
          <div className={styles.l3ContentOriginal}>
            <div className={styles.l3LowContrastH} />
            <div className={styles.l3LowContrastLine1} />
            <div className={styles.l3LowContrastLine2} />
            <div className={styles.l3LowContrastBtn}>Click</div>
          </div>
        </div>
        <motion.div
          className={styles.l3TagOriginal}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: false }}
          transition={{ delay: 0.6 }}
        >
          Tidak Diubah
        </motion.div>
      </div>

      {/* Optimized View */}
      <div className={styles.l3Col}>
        <div className={styles.l3HeaderOptimized}>
          <Palette className={styles.l3SmallIcon} /> Tampilan Di Sini
        </div>
        <div className={styles.l3WindowOptimized}>
          <div className={styles.l3WindowTopBar}>
            <div className={styles.l3TopBarLine} />
          </div>
          <motion.div
            className={styles.l3ContentOptimized}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false }}
            transition={{ delay: 1 }}
          >
            <div className={styles.l3HighContrastH} />
            <div className={styles.l3HighContrastLine1} />
            <div className={styles.l3HighContrastLine2} />
            <div className={styles.l3HighContrastBtn}>CLICK HERE</div>
          </motion.div>
        </div>
        <motion.div
          className={styles.l3TagOptimized}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: false }}
          transition={{ delay: 1.4 }}
        >
          Format Baca
        </motion.div>
      </div>
    </motion.div>
  );
}

export function Limitation4() {
  return (
    <motion.div
      key="limit-4"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={styles.l4Wrap}
    >
      <div className={styles.l4Card}>
        <div className={styles.l4Header}>
          <span>Cakupan Audit</span>
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false }}
            transition={{ delay: 2.2 }}
            className={styles.l4CompleteText}
          >
            100% Selesai
          </motion.span>
        </div>

        {/* Progress Track */}
        <div className={styles.l4ProgressTrack}>
          {/* Automated check */}
          <motion.div
            className={styles.l4ProgressAuto}
            initial={{ width: "0%" }}
            whileInView={{ width: "60%" }}
            viewport={{ once: false }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />

          {/* Manual check */}
          <motion.div
            className={styles.l4ProgressManual}
            initial={{ width: "0%" }}
            whileInView={{ width: "40%" }}
            viewport={{ once: false }}
            transition={{ duration: 1.2, delay: 1.3, ease: "easeOut" }}
          />
        </div>

        {/* Labels below */}
        <div className={styles.l4Columns}>
          <motion.div
            className={styles.l4ColItem}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ delay: 0.4 }}
          >
            <div className={styles.l4IconCircleBlue}>
              <SearchCode className={styles.l4ColIcon} />
            </div>
            <span className={styles.l4ColTitle}>Mesin (60%)</span>
            <span className={styles.l4ColDesc}>
              Mendeteksi masalah teknis &amp; struktur kode
            </span>
          </motion.div>

          <motion.div
            className={styles.l4ColItem}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ delay: 1.6 }}
          >
            <div className={styles.l4IconCircleAmber}>
              <UserCheck className={styles.l4ColIcon} />
              <motion.span
                className={styles.l4PingWrap}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: false }}
                transition={{ delay: 1.6 }}
              >
                <span className={styles.l4PingRing} />
                <span className={styles.l4PingDot} />
              </motion.span>
            </div>
            <span className={styles.l4ColTitle}>Manusia (40%)</span>
            <span className={styles.l4ColDesc}>
              Menilai konteks tulisan &amp; makna visual
            </span>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
