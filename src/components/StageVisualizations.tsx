"use client";

import { motion } from "framer-motion";
import { Globe, LayoutTemplate, ShieldCheck } from "lucide-react";
import styles from "./StageVisualizations.module.css";

export function Stage1() {
  return (
    <motion.div
      key="stage-0"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={styles.stage1Wrap}
    >
      <div className={styles.stage1SearchBar}>
        <motion.div
          className={styles.stage1Sweep}
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        />
        <Globe className={styles.stage1Globe} />
        <div className={styles.stage1UrlBar} />
        <motion.div
          className={styles.stage1CheckmarkBadge}
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: false }}
          transition={{ delay: 0.8, type: "spring" }}
        >
          <div className={styles.checkIconWhite} />
        </motion.div>
      </div>
      <motion.div
        className={styles.stage1BadgesRow}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: false }}
        transition={{ delay: 0.4 }}
      >
        <div className={styles.stage1BadgeCol}>
          <div className={styles.stage1BadgeBox}>
            <div className={styles.stage1BadgeCheckCircle}>
              <div className={styles.checkIconGreen} />
            </div>
          </div>
          <div className={styles.stage1BadgeText}>200 OK</div>
        </div>
        <div className={styles.stage1BadgeCol}>
          <div className={styles.stage1BadgeBox}>
            <div className={styles.stage1BadgeCheckCircle}>
              <div className={styles.checkIconGreen} />
            </div>
          </div>
          <div className={styles.stage1BadgeText}>Robots.txt</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Stage2() {
  return (
    <motion.div
      key="stage-1"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={styles.stage2Wrap}
    >
      <div className={styles.stage2Card}>
        <motion.div
          className={styles.stage2Scanner}
          initial={{ y: "-100%" }}
          animate={{ y: "200%" }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
        />
        <div className={styles.stage2Header}>
          <div className={styles.stage2Avatar} />
          <div className={styles.stage2HeaderLines}>
            <div className={styles.stage2Line75} />
            <div className={styles.stage2Line50} />
          </div>
        </div>
        <motion.div
          className={styles.stage2BoxMissingAlt}
          animate={{ borderColor: ["#e5e7eb", "#ef4444", "#e5e7eb"] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className={styles.badgeMissingAlt}>Missing Alt</div>
        </motion.div>
        <div className={styles.stage2FooterRow}>
          <motion.div
            className={styles.stage2BoxEmptyLabel}
            animate={{ borderColor: ["#e5e7eb", "#ef4444", "#e5e7eb"] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
          >
            <div className={styles.badgeEmptyLabel}>Empty Label</div>
          </motion.div>
          <div className={styles.stage2BoxNormal} />
        </div>
      </div>
    </motion.div>
  );
}

export function Stage3() {
  const fixes = [
    { id: 1, type: "safe", label: "Added aria-label to button" },
    { id: 2, type: "human", label: "Ambiguous contrast ratio" },
    { id: 3, type: "safe", label: "Inferred image alt text" },
  ];

  return (
    <motion.div
      key="stage-2"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={styles.stage3Wrap}
    >
      {fixes.map((fix, i) => (
        <motion.div
          key={fix.id}
          className={styles.stage3FixItem}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false }}
          transition={{ delay: i * 0.2 }}
        >
          <div className={styles.stage3FixLeft}>
            <div className={styles.stage3IconBox}>
              <div className={styles.stage3Dash} />
            </div>
            <div className={styles.stage3Label}>{fix.label}</div>
          </div>
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: false }}
            transition={{ delay: i * 0.2 + 0.3, type: "spring" }}
          >
            {fix.type === "safe" ? (
              <div className={styles.badgeApplied}>
                <ShieldCheck className={styles.badgeAppliedIcon} /> Applied
              </div>
            ) : (
              <div className={styles.badgeReview}>Review</div>
            )}
          </motion.div>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function Stage4() {
  return (
    <motion.div
      key="stage-3"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={styles.stage4Wrap}
    >
      <div className={styles.stage4ChartContainer}>
        <motion.div
          className={styles.stage4BarBefore}
          initial={{ height: 0 }}
          whileInView={{ height: 130 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <span className={styles.stage4NumBefore}>42</span>
          <span className={styles.stage4LabelBefore}>Before</span>
        </motion.div>
        <motion.div
          className={styles.stage4BarAfter}
          initial={{ height: 0 }}
          whileInView={{ height: 36 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
        >
          <span className={styles.stage4NumAfter}>3</span>
          <span className={styles.stage4LabelAfter}>After</span>
        </motion.div>

        <motion.div
          className={styles.stage4ReductionBadge}
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: false }}
          transition={{ delay: 0.8, type: "spring" }}
        >
          <div className={styles.stage4ReductionTitle}>Issue Reduction</div>
          <div className={styles.stage4ReductionVal}>-92%</div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function Stage5() {
  return (
    <motion.div
      key="stage-4"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={styles.stage5Wrap}
    >
      <div className={styles.stage5RelWrap}>
        {/* "Before" messy layout animating out */}
        <motion.div
          className={styles.stage5BeforeLayout}
          initial={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          whileInView={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
          viewport={{ once: false }}
          transition={{ duration: 0.9, delay: 0.3 }}
        >
          <div className={styles.stage5Block1} />
          <div className={styles.stage5Block2} />
          <div className={styles.stage5Block3} />
          <div className={styles.stage5Block4} />
          <div className={styles.stage5Block5} />
        </motion.div>

        {/* "After" clean layout animating in */}
        <motion.div
          className={styles.stage5AfterLayout}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0.8, type: "spring" }}
        >
          <div className={styles.stage5TitleBar} />
          <div className={styles.stage5Paragraph}>
            <div className={styles.stage5TextLine} />
            <div className={styles.stage5TextLine} />
            <div className={styles.stage5TextLineShort} />
          </div>
          <div className={styles.stage5SubTitleBar} />
          <div className={styles.stage5Paragraph}>
            <div className={styles.stage5TextLine} />
            <div className={styles.stage5TextLineMed} />
          </div>

          <motion.div
            className={styles.stage5BadgeIcon}
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: false }}
            transition={{ delay: 1.4, type: "spring" }}
          >
            <LayoutTemplate className={styles.stage5Icon} />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
