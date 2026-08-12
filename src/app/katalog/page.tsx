"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import {
  AuditApiError,
  getAudit,
  readJobToken,
  removeJobToken,
} from "@/lib/audit-api";
import {
  RecentAudit,
  readRecentAudits,
  recentAuditFromJob,
  removeRecentAudit,
  saveRecentAudit,
} from "@/lib/recent-audits";

const ACTIVE = new Set(["queued", "running"]);

function readableDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Waktu tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function statusLabel(item: RecentAudit) {
  if (item.status === "queued") return "Dalam antrean";
  if (item.status === "running") return "Sedang berjalan";
  if (item.status === "completed") return "Selesai";
  if (item.status === "failed") return "Gagal";
  return "Dibatalkan";
}

function AuditCard({
  item,
  onRemove,
}: {
  item: RecentAudit;
  onRemove: (jobId: string) => void;
}) {
  const active = ACTIVE.has(item.status);
  const completed = item.status === "completed";
  const resultHref = `/result?job=${encodeURIComponent(item.jobId)}${completed ? "&open=1" : ""}`;

  return (
    <article className={styles.auditCard}>
      <div className={styles.cardTop}>
        <div className={styles.domainBlock}>
          <h3>{item.title || host(item.sourceUrl)}</h3>
          <p title={item.sourceUrl}>{item.sourceUrl}</p>
        </div>
        <span className={`${styles.status} ${styles[item.status]}`}>
          {statusLabel(item)}
        </span>
      </div>

      <dl className={styles.cardMeta}>
        <div>
          <dt>Dibuat</dt>
          <dd>{readableDate(item.createdAt)}</dd>
        </div>
        <div>
          <dt>Tahap terakhir</dt>
          <dd>{item.stage}</dd>
        </div>
      </dl>

      {active && (
        <div className={styles.progressBlock}>
          <div className={styles.progressLabel}>
            <span>Progress pemeriksaan</span>
            <strong>{item.progress}%</strong>
          </div>
          <progress max="100" value={item.progress}>
            {item.progress}%
          </progress>
        </div>
      )}

      <div className={styles.cardActions}>
        <Link className="btn btn-primary" href={resultHref}>
          {active
            ? "Lanjutkan pemeriksaan"
            : completed
              ? "Buka hasil"
              : "Lihat status"}
        </Link>
        <Link
          className="btn btn-secondary"
          href={`/?url=${encodeURIComponent(item.sourceUrl)}`}
        >
          Periksa ulang
        </Link>
        <button
          className={styles.removeButton}
          type="button"
          onClick={() => onRemove(item.jobId)}
        >
          Hapus dari perangkat ini
        </button>
      </div>
    </article>
  );
}

export default function RiwayatAuditPage() {
  const [items, setItems] = useState<RecentAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState("");

  const refresh = useCallback(async () => {
    const stored = readRecentAudits();
    if (stored.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const verified: RecentAudit[] = [];
    let connectionFailed = false;
    for (const item of stored) {
      const token = readJobToken(item.jobId);
      if (!token) {
        removeRecentAudit(item.jobId);
        continue;
      }
      try {
        const response = await getAudit(item.jobId, token);
        const next = recentAuditFromJob(response.job, item);
        saveRecentAudit(next);
        verified.push(next);
      } catch (error) {
        if (
          error instanceof AuditApiError &&
          (error.code === "AUDIT_NOT_FOUND" || error.code === "RESULT_EXPIRED")
        ) {
          removeRecentAudit(item.jobId);
          removeJobToken(item.jobId);
          continue;
        }
        connectionFailed = true;
        verified.push(item);
      }
    }
    setItems(verified);
    setWarning(
      connectionFailed
        ? "Sebagian status belum dapat dikonfirmasi. Data terakhir di perangkat tetap ditampilkan."
        : "",
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groups = useMemo(
    () => ({
      active: items.filter((item) => ACTIVE.has(item.status)),
      completed: items.filter((item) => item.status === "completed"),
      ended: items.filter(
        (item) => item.status === "failed" || item.status === "cancelled",
      ),
    }),
    [items],
  );

  const handleRemove = (jobId: string) => {
    removeRecentAudit(jobId);
    removeJobToken(jobId);
    setItems((current) => current.filter((item) => item.jobId !== jobId));
  };

  return (
    <main className={styles.main} aria-busy={loading}>
      <section className={styles.hero}>
        <div>
          <h1>Riwayat pemeriksaan tujuh hari terakhir</h1>
          <p>
            Lanjutkan proses aktif atau buka hasil yang masih tersedia di
            perangkat ini.
          </p>
        </div>
        <Link href="/" className="btn btn-primary">
          Mulai pemeriksaan baru
        </Link>
      </section>

      {warning && (
        <p className={styles.warning} role="status">
          {warning}
        </p>
      )}

      {loading ? (
        <section className={styles.loadingState} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <div>
            <h2>Memeriksa riwayat</h2>
            <p>Status dikonfirmasi sebelum hasil ditampilkan.</p>
          </div>
        </section>
      ) : items.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>Belum ada riwayat pemeriksaan</h2>
          <p>
            Masukkan alamat halaman publik di beranda. Tidak ada perintah atau
            persiapan teknis yang perlu dijalankan.
          </p>
          <Link href="/" className="btn btn-primary">
            Mulai dari beranda
          </Link>
        </section>
      ) : (
        <div className={styles.sections}>
          {groups.active.length > 0 && (
            <section aria-labelledby="active-title">
              <div className={styles.sectionHeading}>
                <h2 id="active-title">Sedang berlangsung</h2>
                <span>{groups.active.length}</span>
              </div>
              <div className={styles.auditList}>
                {groups.active.map((item) => (
                  <AuditCard
                    key={item.jobId}
                    item={item}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </section>
          )}

          {groups.completed.length > 0 && (
            <section aria-labelledby="completed-title">
              <div className={styles.sectionHeading}>
                <h2 id="completed-title">Hasil tersedia</h2>
                <span>{groups.completed.length}</span>
              </div>
              <div className={styles.auditList}>
                {groups.completed.map((item) => (
                  <AuditCard
                    key={item.jobId}
                    item={item}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </section>
          )}

          {groups.ended.length > 0 && (
            <section aria-labelledby="ended-title">
              <div className={styles.sectionHeading}>
                <h2 id="ended-title">Tidak selesai</h2>
                <span>{groups.ended.length}</span>
              </div>
              <div className={styles.auditList}>
                {groups.ended.map((item) => (
                  <AuditCard
                    key={item.jobId}
                    item={item}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
