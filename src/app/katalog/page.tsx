"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

/** Lama jendela pembatalan, dalam milidetik. */
const UNDO_DURATION = 7000;

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
  if (item.status === "queued") return "Menunggu giliran";
  if (item.status === "running") return "Sedang diperiksa";
  if (item.status === "completed") return "Hasil siap";
  if (item.status === "failed") return "Tidak berhasil";
  return "Dihentikan";
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
          <dt>Diperiksa</dt>
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
            <span>Kemajuan pemeriksaan</span>
            <strong>{item.progress}%</strong>
          </div>
          <progress
            className={styles.progress}
            max="100"
            value={item.progress}
          >
            {item.progress}%
          </progress>
        </div>
      )}

      <div className={styles.cardActions}>
        <Link className="btn btn-primary" href={resultHref}>
          {active
            ? "Lanjutkan pemeriksaan"
            : completed
              ? "Baca hasil"
              : "Lihat keterangan"}
        </Link>
        <Link
          className="btn btn-secondary"
          href={`/?url=${encodeURIComponent(item.sourceUrl)}`}
        >
          Periksa ulang
        </Link>
        {/*
          Hanya ikon tong sampah, tetapi tetap punya nama yang dibacakan
          pembaca layar dan keterangan singkat saat kursor berhenti di atasnya.
        */}
        <button
          className={styles.removeButton}
          type="button"
          onClick={() => onRemove(item.jobId)}
          aria-label="Hapus riwayat pemeriksaan ini"
          title="Hapus riwayat"
        >
          <svg
            aria-hidden="true"
            focusable="false"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 7h16" />
            <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
            <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    </article>
  );
}

export default function RiwayatAuditPage() {
  const [items, setItems] = useState<RecentAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState("");

  /* Antrean penghapusan. Item disembunyikan lebih dulu, baru benar benar
     dihapus setelah jendela pembatalan berakhir. */
  const [confirmTarget, setConfirmTarget] = useState<RecentAudit | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<RecentAudit | null>(
    null,
  );
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const undoButtonRef = useRef<HTMLButtonElement | null>(null);

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
        ? "Sebagian keterangan belum dapat dipastikan. Catatan terakhir di perangkat ini tetap ditampilkan."
        : "",
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* Penghapusan sebenarnya. Dipanggil hanya setelah jendela pembatalan habis,
     atau saat halaman ditinggalkan. */
  const handleRemove = useCallback((jobId: string) => {
    removeRecentAudit(jobId);
    removeJobToken(jobId);
    setItems((current) => current.filter((item) => item.jobId !== jobId));
  }, []);

  const requestRemove = (jobId: string) => {
    const target = items.find((item) => item.jobId === jobId) ?? null;
    if (target) setConfirmTarget(target);
  };

  const confirmRemove = () => {
    const target = confirmTarget;
    if (!target) return;

    // Bila masih ada penghapusan yang menunggu, selesaikan dulu.
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
      if (pendingRemoval) handleRemove(pendingRemoval.jobId);
    }

    setConfirmTarget(null);
    setPendingRemoval(target);
    undoTimer.current = setTimeout(() => {
      undoTimer.current = null;
      handleRemove(target.jobId);
      setPendingRemoval(null);
    }, UNDO_DURATION);
  };

  const undoRemove = () => {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
    setPendingRemoval(null);
  };

  // Jika halaman ditinggalkan sebelum jendela habis, penghapusan diselesaikan.
  useEffect(() => {
    return () => {
      if (undoTimer.current) {
        clearTimeout(undoTimer.current);
        undoTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (confirmTarget) confirmButtonRef.current?.focus();
  }, [confirmTarget]);

  useEffect(() => {
    if (pendingRemoval) undoButtonRef.current?.focus();
  }, [pendingRemoval]);

  useEffect(() => {
    if (!confirmTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmTarget(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmTarget]);

  // Item yang sedang menunggu penghapusan disembunyikan dari daftar.
  const visible = useMemo(
    () =>
      pendingRemoval
        ? items.filter((item) => item.jobId !== pendingRemoval.jobId)
        : items,
    [items, pendingRemoval],
  );

  const groups = useMemo(
    () => ({
      active: visible.filter((item) => ACTIVE.has(item.status)),
      completed: visible.filter((item) => item.status === "completed"),
      ended: visible.filter(
        (item) => item.status === "failed" || item.status === "cancelled",
      ),
    }),
    [visible],
  );

  return (
    <main className={styles.main} aria-busy={loading}>
      <div className={`${styles.heroWrap} texture-grid`}>
        <section className={`container ${styles.hero}`}>
          <div>
            <p className="eyebrow">Riwayat</p>
            <h1>Pemeriksaan tujuh hari terakhir</h1>
            <p className={styles.heroLead}>
              Catatan ini hanya tersimpan di perangkat ini. Lanjutkan pemeriksaan
              yang masih berjalan, atau baca hasil yang sudah siap.
            </p>
          </div>
          <Link href="/" className="btn btn-primary">
            Periksa halaman baru
          </Link>
        </section>
      </div>

      <div className={`container ${styles.content}`}>
        {warning && (
          <p className={styles.warning} role="status">
            {warning}
          </p>
        )}

        {loading ? (
          <section className={styles.loadingState} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            <div>
              <h2>Membuka riwayat</h2>
              <p>Keterangan tiap pemeriksaan sedang dipastikan.</p>
            </div>
          </section>
        ) : visible.length === 0 ? (
          <section className={styles.emptyState}>
            <span className={styles.emptyMark} aria-hidden="true" />
            <h2>Belum ada pemeriksaan tersimpan</h2>
            <p>
              Setelah satu halaman diperiksa, catatannya muncul di sini dan bisa
              dibuka kembali selama tujuh hari.
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
                  <h2 id="active-title">Sedang berjalan</h2>
                  <span>{groups.active.length}</span>
                </div>
                <div className={styles.auditList}>
                  {groups.active.map((item) => (
                    <AuditCard
                      key={item.jobId}
                      item={item}
                      onRemove={requestRemove}
                    />
                  ))}
                </div>
              </section>
            )}

            {groups.completed.length > 0 && (
              <section aria-labelledby="completed-title">
                <div className={styles.sectionHeading}>
                  <h2 id="completed-title">Hasil siap dibaca</h2>
                  <span>{groups.completed.length}</span>
                </div>
                <div className={styles.auditList}>
                  {groups.completed.map((item) => (
                    <AuditCard
                      key={item.jobId}
                      item={item}
                      onRemove={requestRemove}
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
                      onRemove={requestRemove}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {confirmTarget && (
          <div className={styles.dialogLapis}>
            <div
              className={styles.dialog}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="hapus-title"
              aria-describedby="hapus-desc"
            >
              <h2 id="hapus-title">Hapus catatan pemeriksaan ini?</h2>
              <p id="hapus-desc">
                Catatan untuk{" "}
                <strong>
                  {confirmTarget.title || host(confirmTarget.sourceUrl)}
                </strong>{" "}
                akan hilang dari perangkat ini. Halaman aslinya tidak terpengaruh,
                dan halaman itu bisa diperiksa ulang kapan saja.
              </p>
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={confirmRemove}
                  ref={confirmButtonRef}
                >
                  Ya, hapus
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmTarget(null)}
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingRemoval && (
          <div className={styles.snackbar} role="status">
            <p>
              Catatan{" "}
              {pendingRemoval.title || host(pendingRemoval.sourceUrl)} dihapus.
            </p>
            <button
              type="button"
              className={styles.undoButton}
              onClick={undoRemove}
              ref={undoButtonRef}
            >
              Urungkan
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
