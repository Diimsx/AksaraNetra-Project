"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import {
  AuditJob,
  AuditResult,
  Snapshot,
  artifactUrl,
  cancelAudit,
  checkAuditCache,
  createAudit,
  getAudit,
  getAuditResult,
  presentAuditError,
  readJobToken,
  saveJobToken,
} from "@/lib/audit-api";
import {
  RECENT_AUDIT_VERSION,
  findRecentAudit,
  recentAuditFromJob,
  saveRecentAudit,
} from "@/lib/recent-audits";

type Phase =
  | "initial"
  | "checking-cache"
  | "cache-choice"
  | "creating"
  | "tracking"
  | "ready"
  | "loading-result"
  | "result"
  | "cancelled"
  | "error";

type Failure = {
  title: string;
  message: string;
  actionLabel: string;
};

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function waktu(iso?: string | null) {
  if (!iso) return "Belum tercatat";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Belum tercatat";
  return `${date.getDate()} ${BULAN[date.getMonth()]} ${date.getFullYear()}, ${String(date.getHours()).padStart(2, "0")}.${String(date.getMinutes()).padStart(2, "0")}`;
}

function count(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function friendlyStage(stage?: string, status?: AuditJob["status"]) {
  if (status === "queued") return "Menyiapkan halaman";
  const value = (stage || "").toLowerCase();
  if (/reader/.test(value)) return "Menyiapkan tampilan reader";
  if (/report|pdf|artifact|summary|ringkas/.test(value))
    return "Merangkum hasil";
  if (/patch|apply|verify|verif|rollback|perbaikan/.test(value)) {
    return "Menguji perbaikan";
  }
  if (/audit|axe|scan|rule|hambatan/.test(value)) {
    return "Memeriksa hambatan aksesibilitas";
  }
  return "Menyiapkan halaman";
}

function conclusion(snapshot: Snapshot) {
  const before = count(snapshot.summary.beforeTotal);
  const after = count(snapshot.summary.afterTotal);
  const fixed = count(snapshot.counts.fixed);
  const unresolved =
    after +
    count(snapshot.counts.review) +
    count(snapshot.counts.skipped) +
    count(snapshot.counts.rolledBack);

  if (before === 0 && fixed === 0 && unresolved === 0) {
    return {
      title: "Tidak perlu perbaikan otomatis",
      text: "Pemeriksaan ini tidak menemukan hambatan yang dapat diperbaiki otomatis. Hasil ini tidak berarti halaman sudah sepenuhnya aksesibel.",
      tone: "neutral",
    } as const;
  }

  if (unresolved > 0) {
    return {
      title: "Masih ada hambatan yang perlu ditinjau",
      text: "Beberapa hambatan belum aman untuk diperbaiki otomatis dan memerlukan pemeriksaan lebih lanjut. Kesimpulan ini terbatas pada pemeriksaan yang dilakukan.",
      tone: "attention",
    } as const;
  }

  if (fixed > 0 && after < before) {
    return {
      title: "Sebagian besar hambatan berhasil diperbaiki",
      text: `${fixed} perbaikan berhasil diverifikasi. Tidak ada masalah baru yang ditemukan setelah perbaikan pada pemeriksaan ini.`,
      tone: "success",
    } as const;
  }

  return {
    title: "Perbaikan otomatis belum dapat diterapkan",
    text: "Hambatan ditemukan, tetapi belum ada perbaikan yang dapat diterapkan dengan aman. Kesimpulan ini terbatas pada pemeriksaan yang dilakukan.",
    tone: "attention",
  } as const;
}

function ProgressPanel({
  job,
  onCancel,
}: {
  job: AuditJob | null;
  onCancel: () => void;
}) {
  const progress = count(job?.progress);
  const stage = friendlyStage(job?.stage, job?.status);

  return (
    <section className={styles.statusCard} aria-labelledby="status-title">
      <div className={styles.statusTop}>
        <div className={styles.stageColumn}>
          <p className={styles.statusLabel}>
            <span className={styles.activeDot} aria-hidden="true" />
            {job?.status === "queued"
              ? "Dalam antrean"
              : "Pemeriksaan berjalan"}
          </p>
          <div className={styles.stageArea}>
            <h1 id="status-title" key={stage}>
              {stage}
            </h1>
          </div>
        </div>
        <strong className={styles.percent}>{progress}%</strong>
      </div>

      <progress className={styles.progress} max="100" value={progress}>
        {progress}%
      </progress>

      <div className={styles.statusMeta}>
        <span>
          {job?.queuePosition
            ? `Posisi antrean: ${job.queuePosition}`
            : "Satu pemeriksaan dijalankan pada satu waktu"}
        </span>
        <span>Percobaan {Math.max(job?.attempts ?? 1, 1)} dari 2</span>
      </div>

      <p className={styles.statusNote}>
        Halaman ini boleh ditutup. Buka URL yang sama untuk melanjutkan
        pemantauan.
      </p>

      {job?.canCancel && (
        <button className="btn btn-secondary" type="button" onClick={onCancel}>
          Batalkan pemeriksaan
        </button>
      )}
    </section>
  );
}

function Comparison({ snapshot }: { snapshot: Snapshot }) {
  const before = count(snapshot.summary.beforeTotal);
  const after = count(snapshot.summary.afterTotal);
  const maximum = Math.max(before, after, 1);
  const reduction = count(snapshot.summary.reductionPercent);

  return (
    <section className={styles.section} aria-labelledby="comparison-title">
      <div className={styles.sectionHeading}>
        <h2 id="comparison-title">Sebelum dan sesudah perbaikan</h2>
        <strong className={styles.reduction}>{reduction}% berkurang</strong>
      </div>

      <div
        className={styles.chart}
        role="img"
        aria-label={`${before} temuan sebelum dan ${after} temuan setelah perbaikan`}
      >
        <div className={styles.chartRow}>
          <span>Sebelum</span>
          <div>
            <i style={{ width: `${(before / maximum) * 100}%` }} />
          </div>
          <strong>{before}</strong>
        </div>
        <div className={styles.chartRow}>
          <span>Sesudah</span>
          <div>
            <i
              className={styles.afterBar}
              style={{ width: `${(after / maximum) * 100}%` }}
            />
          </div>
          <strong>{after}</strong>
        </div>
      </div>

      <div
        className={styles.tableWrap}
        role="region"
        aria-label="Perbandingan per aturan"
        tabIndex={0}
      >
        <table className={styles.table}>
          <caption>Jumlah elemen bermasalah untuk setiap aturan target</caption>
          <thead>
            <tr>
              <th scope="col">Aturan</th>
              <th scope="col">Sebelum</th>
              <th scope="col">Sesudah</th>
              <th scope="col">Perubahan</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(snapshot.rules).map(([rule, value]) => (
              <tr key={rule}>
                <th scope="row">
                  <code>{rule}</code>
                </th>
                <td>{count(value.before)}</td>
                <td>{count(value.after)}</td>
                <td>{count(value.before) - count(value.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ResultView({ data }: { data: AuditResult }) {
  const snapshot = data.result.snapshot;
  const summary = conclusion(snapshot);
  const fixed = count(snapshot.counts.fixed);
  const rolledBack = count(snapshot.counts.rolledBack);
  const skipped = count(snapshot.counts.skipped);
  const links = Object.fromEntries(
    Object.entries(data.links).map(([key, value]) => [key, artifactUrl(value)]),
  ) as Record<keyof AuditResult["links"], string>;

  return (
    <main className={styles.resultContainer}>
      <div className={styles.notice}>
        <span aria-hidden="true">i</span>
        <p>
          Anda sedang melihat tampilan alternatif yang dibuat AksaraNetra.
          Kontennya tetap berasal dari situs terkait dan situs asli tidak
          diubah.
        </p>
      </div>

      <header className={styles.resultHeader}>
        <p className={styles.statusLabel}>Pemeriksaan selesai</p>
        <h1>{snapshot.source.title || "Hasil pemeriksaan halaman"}</h1>
        <p className={styles.source}>
          Sumber:{" "}
          <a
            href={snapshot.source.finalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {snapshot.source.finalUrl}
          </a>
        </p>
        <p className={styles.timestamp}>
          Diperiksa {waktu(snapshot.capturedAt)} · Engine{" "}
          {snapshot.engineVersion}
        </p>
      </header>

      <section className={styles.primaryActions} aria-label="Buka hasil utama">
        <a
          className="btn btn-primary"
          href={links.reader}
          target="_blank"
          rel="noopener noreferrer"
        >
          Buka reader
        </a>
        <a
          className="btn btn-secondary"
          href={links.reportPdf}
          target="_blank"
          rel="noopener noreferrer"
        >
          Unduh laporan PDF
        </a>
        <a
          className="btn btn-secondary"
          href={links.patched}
          target="_blank"
          rel="noopener noreferrer"
        >
          Lihat halaman hasil
        </a>
      </section>

      <section className={styles.metricGrid} aria-label="Ringkasan pemeriksaan">
        <article>
          <span>Temuan awal</span>
          <strong>{count(snapshot.summary.beforeTotal)}</strong>
        </article>
        <article>
          <span>Temuan akhir</span>
          <strong>{count(snapshot.summary.afterTotal)}</strong>
        </article>
        <article>
          <span>Perbaikan terverifikasi</span>
          <strong>{fixed}</strong>
        </article>
        <article>
          <span>Perlu ditinjau</span>
          <strong>{count(snapshot.counts.review)}</strong>
        </article>
      </section>

      <section
        className={`${styles.conclusionCard} ${styles[summary.tone]}`}
        aria-labelledby="conclusion-title"
      >
        <h2 id="conclusion-title">{summary.title}</h2>
        <p>{summary.text}</p>
      </section>

      <Comparison snapshot={snapshot} />

      <section className={styles.section} aria-labelledby="verification-title">
        <div className={styles.sectionHeading}>
          <h2 id="verification-title">Hasil pemeriksaan perbaikan</h2>
          <span
            className={
              snapshot.warnings.wcagRegressionClean
                ? styles.goodBadge
                : styles.attentionBadge
            }
          >
            {snapshot.warnings.wcagRegressionClean
              ? "Tidak ada masalah baru setelah perbaikan"
              : "Masih memerlukan pemeriksaan"}
          </span>
        </div>

        <div className={styles.verificationGrid}>
          <div>
            <strong>{fixed}</strong>
            <span>Perbaikan terverifikasi</span>
          </div>
          <div>
            <strong>{rolledBack}</strong>
            <span>Perbaikan dibatalkan</span>
          </div>
          <div>
            <strong>{skipped}</strong>
            <span>Kandidat dilewati</span>
          </div>
        </div>

        <details className={styles.details}>
          <summary>Lihat detail pemeriksaan</summary>
          <dl>
            <div>
              <dt>Strict improvement</dt>
              <dd>{snapshot.summary.strictImprovement ? "Ya" : "Tidak"}</dd>
            </div>
            <div>
              <dt>Regresi WCAG pada rule target</dt>
              <dd>{snapshot.summary.noRegression ? "Tidak ada" : "Ada"}</dd>
            </div>
            <div>
              <dt>Human override</dt>
              <dd>{count(snapshot.counts.verifiedOverrides)}</dd>
            </div>
            <div>
              <dt>Stale override</dt>
              <dd>{snapshot.warnings.staleOverrides?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Verifikasi per elemen</dt>
              <dd>{fixed}</dd>
            </div>
            <div>
              <dt>Detail axe</dt>
              <dd>Tersedia di laporan PDF</dd>
            </div>
          </dl>
        </details>
      </section>

      <section className={styles.evidenceCard}>
        <div>
          <h2>Bukti pemeriksaan</h2>
          <p>
            Screenshot memperlihatkan halaman setelah perbaikan. Detail axe
            tersedia di laporan PDF.
          </p>
        </div>
        <a
          className="btn btn-secondary"
          href={links.screenshot}
          target="_blank"
          rel="noopener noreferrer"
        >
          Buka screenshot
        </a>
      </section>

      <div className={styles.bottomActions}>
        <Link href="/" className="btn btn-primary">
          Periksa halaman lain
        </Link>
        <Link href="/katalog" className="btn btn-secondary">
          Kembali ke riwayat
        </Link>
      </div>
    </main>
  );
}

function ResultPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const urlParam = params.get("url");
  const jobParam = params.get("job");
  const directOpen = params.get("open") === "1";
  const [phase, setPhase] = useState<Phase>("initial");
  const [jobId, setJobId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [job, setJob] = useState<AuditJob | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{
    capturedAt: string | null;
    expiresAt: string | null;
  } | null>(null);
  const [failure, setFailureState] = useState<Failure>({
    title: "Pemeriksaan belum berhasil",
    message: "Terjadi kendala yang tidak terduga.",
    actionLabel: "Kembali ke beranda",
  });
  const [liveStage, setLiveStage] = useState("");
  const creatingAudit = useRef(false);
  const lastStage = useRef("");

  const fail = useCallback((error: unknown) => {
    const presented = presentAuditError(error);
    setFailureState(presented);
    setPhase("error");
  }, []);

  const loadResult = useCallback(
    async (targetJobId: string, accessToken: string) => {
      setPhase("loading-result");
      try {
        const nextResult = await getAuditResult(targetJobId, accessToken);
        setResult(nextResult);
        const previous = findRecentAudit(targetJobId);
        saveRecentAudit({
          ...recentAuditFromJob(nextResult.job, previous),
          title:
            nextResult.result.snapshot.source.title ||
            previous?.title ||
            undefined,
        });
        setPhase("result");
      } catch (error) {
        fail(error);
      }
    },
    [fail],
  );

  const beginAudit = useCallback(
    async (reuseExisting: boolean) => {
      if (!urlParam || creatingAudit.current) return;
      creatingAudit.current = true;
      setPhase("creating");
      try {
        const created = await createAudit(urlParam, reuseExisting);
        const now = new Date().toISOString();
        saveJobToken(created.jobId, created.accessToken);
        saveRecentAudit({
          version: RECENT_AUDIT_VERSION,
          jobId: created.jobId,
          sourceUrl: urlParam,
          status: created.status,
          stage: "Menyiapkan halaman",
          progress: 0,
          createdAt: now,
          updatedAt: now,
          expiresAt: created.expiresAt,
        });
        setJobId(created.jobId);
        setToken(created.accessToken);
        setPhase("tracking");
        router.replace(`/result?job=${encodeURIComponent(created.jobId)}`);
      } catch (error) {
        creatingAudit.current = false;
        fail(error);
      }
    },
    [fail, router, urlParam],
  );

  useEffect(() => {
    if (jobParam) {
      const saved = readJobToken(jobParam);
      if (!saved) {
        queueMicrotask(() => {
          setFailureState({
            title: "Hasil tidak dapat dibuka",
            message:
              "Token pemeriksaan tidak ditemukan di perangkat ini. Jalankan pemeriksaan ulang dari beranda.",
            actionLabel: "Periksa ulang",
          });
          setPhase("error");
        });
        return;
      }
      setJobId(jobParam);
      setToken(saved);
      if (directOpen) {
        void loadResult(jobParam, saved);
      } else {
        setPhase("tracking");
      }
      return;
    }

    if (!urlParam) {
      queueMicrotask(() => {
        setFailureState({
          title: "Alamat pemeriksaan tidak ditemukan",
          message: "Mulai pemeriksaan baru dari beranda.",
          actionLabel: "Kembali ke beranda",
        });
        setPhase("error");
      });
      return;
    }

    let active = true;
    setPhase("checking-cache");
    checkAuditCache(urlParam)
      .then((cache) => {
        if (!active) return;
        if (cache.available) {
          setCacheInfo(cache);
          setPhase("cache-choice");
        } else {
          void beginAudit(false);
        }
      })
      .catch((error) => {
        if (active) fail(error);
      });

    return () => {
      active = false;
    };
  }, [beginAudit, directOpen, fail, jobParam, loadResult, urlParam]);

  useEffect(() => {
    if (phase !== "tracking" || !jobId || !token) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const response = await getAudit(jobId, token);
        if (!active) return;
        setJob(response.job);
        saveRecentAudit(
          recentAuditFromJob(response.job, findRecentAudit(jobId)),
        );
        const nextStage = friendlyStage(
          response.job.stage,
          response.job.status,
        );
        if (nextStage !== lastStage.current) {
          lastStage.current = nextStage;
          setLiveStage(nextStage);
        }
        if (response.job.status === "completed") {
          setPhase("ready");
          return;
        }
        if (response.job.status === "failed") {
          fail(response.job.error);
          return;
        }
        if (response.job.status === "cancelled") {
          setPhase("cancelled");
          return;
        }
        timer = setTimeout(poll, 1500);
      } catch (error) {
        if (active) fail(error);
      }
    };

    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fail, jobId, phase, token]);

  const stopAudit = async () => {
    if (!jobId || !token) return;
    try {
      const response = await cancelAudit(jobId, token);
      setJob(response.job);
      saveRecentAudit(recentAuditFromJob(response.job, findRecentAudit(jobId)));
      setPhase("cancelled");
    } catch (error) {
      fail(error);
    }
  };

  if (phase === "result" && result) return <ResultView data={result} />;

  return (
    <main className={styles.shell}>
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {liveStage}
      </p>

      {(phase === "checking-cache" ||
        phase === "creating" ||
        phase === "initial") && (
        <section className={styles.centerCard}>
          <div className={styles.spinner} aria-hidden="true" />
          <h1>
            {phase === "checking-cache"
              ? "Memeriksa hasil tersimpan"
              : "Menyiapkan pemeriksaan"}
          </h1>
          <p>Belum ada hasil yang diklaim pada tahap ini.</p>
        </section>
      )}

      {phase === "cache-choice" && (
        <section className={styles.centerCard}>
          <h1>Hasil tersimpan tersedia</h1>
          <p>
            Hasil dibuat {waktu(cacheInfo?.capturedAt)} dan tersedia sampai{" "}
            {waktu(cacheInfo?.expiresAt)}.
          </p>
          <div className={styles.choiceActions}>
            <button
              className="btn btn-primary"
              onClick={() => void beginAudit(true)}
            >
              Gunakan hasil tersimpan
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => void beginAudit(false)}
            >
              Periksa ulang
            </button>
          </div>
        </section>
      )}

      {phase === "tracking" && (
        <ProgressPanel job={job} onCancel={() => void stopAudit()} />
      )}

      {phase === "ready" && (
        <section className={styles.centerCard}>
          <p className={styles.statusLabel}>Pemeriksaan selesai</p>
          <h1>Reader dan laporan sudah siap</h1>
          <p>Hasil dibuka setelah Anda memilih tindakan berikutnya.</p>
          <button
            className="btn btn-primary"
            onClick={() => jobId && token && void loadResult(jobId, token)}
          >
            Buka hasil
          </button>
        </section>
      )}

      {phase === "loading-result" && (
        <section className={styles.centerCard} role="status">
          <div className={styles.spinner} aria-hidden="true" />
          <h1>Membuka hasil pemeriksaan</h1>
          <p>Reader dan laporan sedang disiapkan.</p>
        </section>
      )}

      {phase === "cancelled" && (
        <section className={styles.centerCard}>
          <h1>Pemeriksaan dibatalkan</h1>
          <p>Artefak sementara sudah dihapus.</p>
          <Link href="/" className="btn btn-primary">
            Kembali ke beranda
          </Link>
        </section>
      )}

      {phase === "error" && (
        <section className={`${styles.centerCard} ${styles.errorCard}`}>
          <h1>{failure.title}</h1>
          <p>{failure.message}</p>
          <div className={styles.choiceActions}>
            <Link href="/" className="btn btn-primary">
              {failure.actionLabel}
            </Link>
            <Link href="/katalog" className="btn btn-secondary">
              Kembali ke riwayat
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.shell}>
          <section className={styles.centerCard}>
            <h1>Memuat pemeriksaan</h1>
          </section>
        </main>
      }
    >
      <ResultPageContent />
    </Suspense>
  );
}
