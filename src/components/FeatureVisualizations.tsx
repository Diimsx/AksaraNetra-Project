"use client";

import { motion } from "framer-motion";
import {
  Image as ImageIcon,
  Code,
  Keyboard,
  CheckCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import styles from "./FeatureVisualizations.module.css";

export function Feature1() {
  return (
    <motion.div
      key="feature-1"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={styles.f1Wrap}
    >
      <div className={styles.f1Card}>
        <motion.div
          className={styles.f1NoLabelBadge}
          initial={{ opacity: 1 }}
          whileInView={{ opacity: 0, scale: 0.8 }}
          viewport={{ once: false }}
          transition={{ delay: 1.4, duration: 0.3 }}
        >
          No Label
        </motion.div>

        <ImageIcon className={styles.f1ImageIcon} />

        <motion.div
          className={styles.f1AriaBadge}
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: false }}
          transition={{ delay: 1.7, type: "spring" }}
        >
          <Code className={styles.f1CodeIcon} />
          aria-label="Thumbnail"
        </motion.div>
      </div>

      <motion.div
        className={styles.f1ProgressTrack}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: false }}
        transition={{ delay: 0.4 }}
      >
        <motion.div
          className={styles.f1ProgressBar}
          initial={{ width: "0%" }}
          whileInView={{ width: "100%" }}
          viewport={{ once: false }}
          transition={{ duration: 1.2, delay: 0.4, ease: "easeInOut" }}
        />
      </motion.div>

      <motion.p
        className={styles.f1ScanText}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: [0, 1, 0] }}
        viewport={{ once: false }}
        transition={{ duration: 1.6, delay: 0.4 }}
      >
        Scanning DOM elements...
      </motion.p>
    </motion.div>
  );
}

export function Feature2() {
  return (
    <motion.div
      key="feature-2"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={styles.f2Wrap}
    >
      <div className={styles.f2TabBadge}>
        <Keyboard className={styles.f2KeyboardIcon} />
        <span>Press &apos;Tab&apos;</span>
      </div>

      <motion.div
        className={styles.f2Item1}
        animate={{ borderColor: ["transparent", "#3b82f6", "transparent"] }}
        transition={{
          duration: 2,
          times: [0, 0.5, 1],
          repeat: Infinity,
          repeatDelay: 3.5,
        }}
      >
        <div className={styles.f2Circle} />
        <div className={styles.f2LineShort} />
      </motion.div>

      <motion.div
        className={styles.f2Item2}
        animate={{
          borderColor: ["transparent", "transparent", "#3b82f6", "transparent"],
        }}
        transition={{
          duration: 2,
          times: [0, 0.4, 0.9, 1],
          repeat: Infinity,
          repeatDelay: 3.5,
        }}
      >
        <div className={styles.f2HeaderRow}>
          <div className={styles.f2LineMed} />
          <motion.div
            className={styles.f2TabIndexBadge}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1, 0] }}
            transition={{
              duration: 2,
              times: [0, 0.4, 0.9, 1],
              repeat: Infinity,
              repeatDelay: 3.5,
            }}
          >
            tabIndex=&#123;0&#125;
          </motion.div>
        </div>
        <div className={styles.f2ScrollArea}>
          <div className={styles.f2ScrollTrack}>
            <motion.div
              className={styles.f2ScrollThumb}
              animate={{
                height: ["20%", "20%", "60%", "20%"],
                top: ["0%", "0%", "40%", "0%"],
              }}
              transition={{
                duration: 2,
                times: [0, 0.4, 0.9, 1],
                repeat: Infinity,
                repeatDelay: 3.5,
              }}
            />
          </div>
          <div className={styles.f2ContentLines}>
            <div className={styles.f2TextLineFull} />
            <div className={styles.f2TextLine80} />
            <div className={styles.f2TextLine75} />
            <div className={styles.f2TextLineFull} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Feature3() {
  return (
    <motion.div
      key="feature-3"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={styles.f3Wrap}
    >
      {/* Before */}
      <motion.div
        className={styles.f3BeforeLayout}
        initial={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        whileInView={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
        viewport={{ once: false }}
        transition={{ duration: 0.9, delay: 0.6 }}
      >
        <div className={styles.f3LowContrastBlock}>Low Contrast</div>
        <div className={styles.f3SmallTextBlock}>Small Text</div>
        <div className={styles.f3MessyContainer}>
          <div className={styles.f3MessyLeft} />
          <div className={styles.f3MessyRight}>
            <div className={styles.f3MessyLine} />
            <div className={styles.f3MessyLine} />
          </div>
        </div>
      </motion.div>

      {/* After */}
      <motion.div
        className={styles.f3AfterLayout}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 1.1, type: "spring" }}
      >
        <div className={styles.f3Group}>
          <div className={styles.f3H1Tag}>H1</div>
          <div className={styles.f3H1Title} />
        </div>

        <div className={styles.f3Group}>
          <div className={styles.f3BodyTag}>Body</div>
          <div className={styles.f3BodyLine} />
          <div className={styles.f3BodyLine} />
          <div className={styles.f3BodyLine80} />
        </div>

        <div className={styles.f3MediaBox}>
          <div className={styles.f3PlayCircle}>
            <div className={styles.f3PlayTriangle} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Feature4() {
  return (
    <motion.div
      key="feature-4"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={styles.f4Wrap}
    >
      {/* Rejected Fix */}
      <motion.div
        className={styles.f4Card}
        initial={{ opacity: 0, x: -16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: false }}
        transition={{ delay: 0.2 }}
      >
        <div className={styles.f4Header}>
          <span className={styles.f4AttemptText}>Fix Attempt 1</span>
          <span className={styles.f4BadgeRejected}>
            <XCircle className={styles.f4BadgeIcon} /> Rejected
          </span>
        </div>
        <div className={styles.f4ScoreRow}>
          <div className={styles.f4ScoreBox}>
            <div className={styles.f4ScoreLabel}>Score</div>
            <div className={styles.f4ScoreVal}>82</div>
          </div>
          <ArrowRight className={styles.f4ArrowIcon} />
          <div className={[styles.f4ScoreBox, styles.f4ScoreBad].join(" ")}>
            <div className={styles.f4ScoreLabel}>Score</div>
            <div className={styles.f4ScoreVal}>75</div>
          </div>
        </div>
        <div className={styles.f4NoteRejected}>Contrast ratio decreased</div>
      </motion.div>

      {/* Accepted Fix */}
      <motion.div
        className={[styles.f4Card, styles.f4CardAccepted].join(" ")}
        initial={{ opacity: 0, x: -16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: false }}
        transition={{ delay: 0.5 }}
      >
        <motion.div
          className={styles.f4GreenGlow}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: [0, 1, 0] }}
          viewport={{ once: false }}
          transition={{ duration: 1.5, delay: 0.8 }}
        />
        <div className={styles.f4Header}>
          <span className={styles.f4AttemptText}>Fix Attempt 2</span>
          <span className={styles.f4BadgeAccepted}>
            <CheckCircle className={styles.f4BadgeIcon} /> Accepted
          </span>
        </div>
        <div className={styles.f4ScoreRow}>
          <div className={styles.f4ScoreBox}>
            <div className={styles.f4ScoreLabel}>Score</div>
            <div className={styles.f4ScoreVal}>75</div>
          </div>
          <ArrowRight className={styles.f4ArrowIcon} />
          <div className={[styles.f4ScoreBox, styles.f4ScoreGood].join(" ")}>
            <div className={styles.f4ScoreLabel}>Score</div>
            <div className={styles.f4ScoreVal}>98</div>
          </div>
        </div>
        <div className={styles.f4NoteAccepted}>Navigation restored</div>
      </motion.div>
    </motion.div>
  );
}
