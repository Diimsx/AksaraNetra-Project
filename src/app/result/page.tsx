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
  readJobToken,
  saveJobToken,
} from "@/lib/audit-api";

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

function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan yang tidak terduga.";
}

function ProgressPanel({
  job,
  onCancel,
}: {
  job: AuditJob | null;
  onCancel: () => void;
}) {
  const progress = job?.progress ?? 0;
  return (
    <section className={styles.statusCard} aria-labelledby="status-title">
      <div className={styles.statusTop}>
        <div>
          <p className={styles.eyebrow}>
            {job?.status === "queued" ? "Dalam antrean" : "Audit berjalan"}
          </p>
          <h1 id="status-title">{job?.stage || "Menyiapkan audit"}</h1>
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
            : "Satu audit dijalankan pada satu waktu"}
        </span>
        <span>Percobaan {Math.max(job?.attempts ?? 1, 1)} dari 2</span>
      </div>
      <p className={styles.statusNote}>
        Halaman ini boleh ditutup. Buka kembali URL yang sama untuk melanjutkan
        pemantauan.
      </p>
      {job?.canCancel && (
        <button className="btn btn-secondary" type="button" onClick={onCancel}>
          Batalkan audit
        </button>
      )}
    </section>
  );
}

function Comparison({ snapshot }: { snapshot: Snapshot }) {
  const before = snapshot.summary.beforeTotal;
  const after = snapshot.summary.afterTotal;
  const maximum = Math.max(before, after, 1);
  return (
    <section className={styles.section} aria-labelledby="comparison-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Pengukuran target</p>
          <h2 id="comparison-title">Sebelum dan sesudah patch</h2>
        </div>
        <strong className={styles.reduction}>
          {snapshot.summary.reductionPercent}% berkurang
        </strong>
      </div>
      <div
        className={styles.chart}
        role="img"
        aria-label={`${before} temuan sebelum dan ${after} temuan setelah patch`}
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
        aria-label="Perbandingan per rule"
        tabIndex={0}
      >
        <table className={styles.table}>
          <caption>Jumlah node bermasalah untuk setiap rule target</caption>
          <thead>
            <tr>
              <th scope="col">Rule</th>
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
                <td>{value.before}</td>
                <td>{value.after}</td>
                <td>{value.before - value.after}</td>
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
  const links = Object.fromEntries(
    Object.entries(data.links).map(([key, value]) => [key, artifactUrl(value)]),
  ) as Record<keyof AuditResult["links"], string>;
  return (
    <div className={styles.resultContainer}>
      <div className={styles.notice}>
        <span aria-hidden="true">i</span>
        <p>{snapshot.disclaimer}</p>
      </div>
      <header className={styles.resultHeader}>
        <p className={styles.eyebrow}>Audit terukur selesai</p>
        <h1>{snapshot.source.title || "Hasil audit halaman"}</h1>
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
          Diuji {waktu(snapshot.capturedAt)} · Engine {snapshot.engineVersion}
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
          Lihat halaman dipatch
        </a>
      </section>

      <section className={styles.metricGrid} aria-label="Ringkasan audit">
        <article>
          <span>Temuan awal</span>
          <strong>{snapshot.summary.beforeTotal}</strong>
        </article>
        <article>
          <span>Temuan akhir</span>
          <strong>{snapshot.summary.afterTotal}</strong>
        </article>
        <article>
          <span>Patch terverifikasi</span>
          <strong>{snapshot.counts.fixed}</strong>
        </article>
        <article>
          <span>Perlu review</span>
          <strong>{snapshot.counts.review}</strong>
        </article>
      </section>

      <Comparison snapshot={snapshot} />

      <section className={styles.section} aria-labelledby="verification-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Verifikasi</p>
            <h2 id="verification-title">Status kualitas patch</h2>
          </div>
          <span
            className={
              snapshot.warnings.wcagRegressionClean
                ? styles.goodBadge
                : styles.warningBadge
            }
          >
            {snapshot.warnings.wcagRegressionClean
              ? "Tidak ada regresi WCAG luas"
              : "Perlu pemeriksaan regresi"}
          </span>
        </div>
        <div className={styles.verificationGrid}>
          <div>
            <strong>{snapshot.counts.fixed}</strong>
            <span>berhasil diverifikasi per elemen</span>
          </div>
          <div>
            <strong>{snapshot.counts.rolledBack}</strong>
            <span>patch dibatalkan</span>
          </div>
          <div>
            <strong>{snapshot.counts.skipped}</strong>
            <span>kandidat dilewati</span>
          </div>
        </div>
        <details className={styles.details}>
          <summary>Lihat detail teknis dan peringatan</summary>
          <dl>
            <div>
              <dt>Strict improvement</dt>
              <dd>{snapshot.summary.strictImprovement ? "Ya" : "Tidak"}</dd>
            </div>
            <div>
              <dt>Regresi rule target</dt>
              <dd>{snapshot.summary.noRegression ? "Tidak ada" : "Ada"}</dd>
            </div>
            <div>
              <dt>Override manusia</dt>
              <dd>{snapshot.counts.verifiedOverrides}</dd>
            </div>
            <div>
              <dt>Override kedaluwarsa</dt>
              <dd>{snapshot.warnings.staleOverrides.length}</dd>
            </div>
          </dl>
        </details>
      </section>

      <section className={styles.evidenceCard}>
        <div>
          <h2>Bukti audit</h2>
          <p>
            Screenshot memperlihatkan DOM setelah patch. Detail axe tersedia di
            laporan PDF.
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
          Audit halaman lain
        </Link>
        <Link href="/cara-kerja" className="btn btn-secondary">
          Pelajari cara kerja
        </Link>
      </div>
    </div>
  );
}

function ResultPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const urlParam = params.get("url");
  const jobParam = params.get("job");
  const [phase, setPhase] = useState<Phase>("initial");
  const [jobId, setJobId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [job, setJob] = useState<AuditJob | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{
    capturedAt: string | null;
    expiresAt: string | null;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [liveStage, setLiveStage] = useState("");
  const creatingAudit = useRef(false);
  const lastStage = useRef("");

  const beginAudit = useCallback(
    async (reuseExisting: boolean) => {
      if (!urlParam || creatingAudit.current) return;
      creatingAudit.current = true;
      setPhase("creating");
      setMessage("");
      try {
        const created = await createAudit(urlParam, reuseExisting);
        saveJobToken(created.jobId, created.accessToken);
        setJobId(created.jobId);
        setToken(created.accessToken);
        setPhase("tracking");
        router.replace(`/result?job=${encodeURIComponent(created.jobId)}`);
      } catch (error) {
        creatingAudit.current = false;
        setMessage(errorText(error));
        setPhase("error");
      }
    },
    [router, urlParam],
  );

  useEffect(() => {
    if (jobParam) {
      const saved = readJobToken(jobParam);
      if (!saved) {
        setMessage(
          "Token audit tidak ditemukan di browser ini. Mulai audit baru dari beranda.",
        );
        setPhase("error");
        return;
      }
      setJobId(jobParam);
      setToken(saved);
      setPhase("tracking");
      return;
    }
    if (!urlParam) {
      if (!urlParam && !jobParam) {
        setMessage("URL audit tidak ditemukan.");
        setPhase("error");
      }
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
        if (!active) return;
        setMessage(errorText(error));
        setPhase("error");
      });
    return () => {
      active = false;
    };
  }, [beginAudit, jobParam, urlParam]);

  useEffect(() => {
    if (phase !== "tracking" || !jobId || !token) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await getAudit(jobId, token);
        if (!active) return;
        setJob(response.job);
        if (response.job.stage !== lastStage.current) {
          lastStage.current = response.job.stage;
          setLiveStage(response.job.stage);
        }
        if (response.job.status === "completed") {
          setPhase("ready");
          return;
        }
        if (response.job.status === "failed") {
          setMessage(response.job.error?.message || "Audit gagal.");
          setPhase("error");
          return;
        }
        if (response.job.status === "cancelled") {
          setPhase("cancelled");
          return;
        }
        timer = setTimeout(poll, 1500);
      } catch (error) {
        if (!active) return;
        setMessage(errorText(error));
        setPhase("error");
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [jobId, phase, token]);

  const openResult = async () => {
    if (!jobId || !token) return;
    setPhase("loading-result");
    try {
      setResult(await getAuditResult(jobId, token));
      setPhase("result");
    } catch (error) {
      setMessage(errorText(error));
      setPhase("error");
    }
  };

  const stopAudit = async () => {
    if (!jobId || !token) return;
    try {
      const response = await cancelAudit(jobId, token);
      setJob(response.job);
      setPhase("cancelled");
    } catch (error) {
      setMessage(errorText(error));
      setPhase("error");
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
          <p className={styles.eyebrow}>Menyiapkan</p>
          <h1>
            {phase === "checking-cache"
              ? "Memeriksa hasil tersimpan"
              : "Membuat job audit"}
          </h1>
          <p>Belum ada pengukuran yang diklaim pada tahap ini.</p>
        </section>
      )}
      {phase === "cache-choice" && (
        <section className={styles.centerCard}>
          <p className={styles.eyebrow}>Hasil tersimpan tersedia</p>
          <h1>Pilih hasil lama atau audit ulang</h1>
          <p>
            Hasil tersimpan dibuat {waktu(cacheInfo?.capturedAt)} dan tersedia
            sampai {waktu(cacheInfo?.expiresAt)}.
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
              Audit ulang
            </button>
          </div>
        </section>
      )}
      {phase === "tracking" && (
        <ProgressPanel job={job} onCancel={() => void stopAudit()} />
      )}
      {phase === "ready" && (
        <section className={styles.centerCard}>
          <div className={styles.doneMark} aria-hidden="true">
            ✓
          </div>
          <p className={styles.eyebrow}>Audit selesai</p>
          <h1>Reader dan laporan sudah siap</h1>
          <p>
            Hasil tidak dibuka otomatis agar kamu tetap memegang kendali
            navigasi.
          </p>
          <button className="btn btn-primary" onClick={() => void openResult()}>
            Buka hasil
          </button>
        </section>
      )}
      {phase === "loading-result" && (
        <section className={styles.centerCard}>
          <div className={styles.spinner} aria-hidden="true" />
          <h1>Membuka hasil audit</h1>
        </section>
      )}
      {phase === "cancelled" && (
        <section className={styles.centerCard}>
          <p className={styles.eyebrow}>Dibatalkan</p>
          <h1>Audit telah dibatalkan</h1>
          <p>Artefak sementara sudah dihapus.</p>
          <Link href="/" className="btn btn-primary">
            Kembali ke beranda
          </Link>
        </section>
      )}
      {phase === "error" && (
        <section className={`${styles.centerCard} ${styles.errorCard}`}>
          <p className={styles.eyebrow}>Tidak dapat melanjutkan</p>
          <h1>Audit belum berhasil</h1>
          <p>{message}</p>
          <Link href="/" className="btn btn-primary">
            Coba lagi
          </Link>
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
            <h1>Memuat audit</h1>
          </section>
        </main>
      }
    >
      <ResultPageContent />
    </Suspense>
  );
}
