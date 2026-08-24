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
  actionHref: string;
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

/*
  Angka hasil berhitung naik saat pertama kali tampil. Murni hiasan:
  angka yang berubah disembunyikan dari pembaca layar, dan angka sebenarnya
  selalu tersedia sebagai teks yang hanya dibacakan pembaca layar. Kalau
  animasi tidak berjalan, angka akhirnya tetap sama.
*/
function AngkaNaik({ value }: { value: number }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || value <= 0) {
      setShown(value);
      return;
    }

    let frame = 0;
    const duration = 700;
    const started = performance.now();

    setShown(0);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(value * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className={styles.srOnly}>{value}</span>
    </>
  );
}

function friendlyStage(stage?: string, status?: AuditJob["status"]) {
  if (status === "queued") return "Menyiapkan halaman";
  const value = (stage || "").toLowerCase();
  if (/reader/.test(value)) return "Menyiapkan tampilan ramah akses";
  if (/report|pdf|artifact|summary|ringkas/.test(value))
    return "Merangkum hasil";
  if (/patch|apply|verify|verif|rollback|perbaikan/.test(value)) {
    return "Menguji perbaikan";
  }
  if (/audit|axe|scan|rule|hambatan/.test(value)) {
    return "Memeriksa hambatan pada halaman";
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
      title: "Tidak ada bagian yang bisa diperbaiki di sini",
      text: "Pemeriksaan ini tidak menemukan bagian yang bisa diperbaiki sendiri oleh AksaraNetra. Ini bukan berarti halaman sudah mudah digunakan semua orang.",
      tone: "neutral",
    } as const;
  }

  if (unresolved > 0) {
    return {
      title: "Masih ada bagian yang perlu diperiksa orang",
      text: "Sebagian hambatan belum aman untuk diperbaiki sendiri oleh AksaraNetra, jadi masih perlu diperiksa lebih lanjut. Kesimpulan ini hanya berlaku untuk halaman yang diperiksa.",
      tone: "attention",
    } as const;
  }

  if (fixed > 0 && after < before) {
    return {
      title: "Sebagian besar hambatan berhasil diperbaiki",
      text: `${fixed} bagian sudah diperbaiki dan diperiksa ulang. Tidak ada masalah baru yang muncul setelah perbaikan.`,
      tone: "success",
    } as const;
  }

  return {
    title: "Belum ada bagian yang bisa diperbaiki dengan aman",
    text: "Hambatan ditemukan, tetapi belum ada yang bisa diperbaiki tanpa risiko mengubah arti halaman. Kesimpulan ini hanya berlaku untuk halaman yang diperiksa.",
    tone: "attention",
  } as const;
}

function useSmoothProgress(targetProgress: number) {
  const [displayProgress, setDisplayProgress] = useState(targetProgress);
  const currentRef = useRef(targetProgress);

  useEffect(() => {
    let animationFrameId: number;
    const startValue = currentRef.current;
    const diff = targetProgress - startValue;
    if (diff === 0) return;

    const duration = Math.min(Math.max(Math.abs(diff) * 14, 350), 750);
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progressRatio = Math.min(elapsed / duration, 1);
      // Cubic ease-out interpolation
      const ease = 1 - Math.pow(1 - progressRatio, 3);
      const val = Math.round(startValue + diff * ease);
      currentRef.current = val;
      setDisplayProgress(val);

      if (progressRatio < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [targetProgress]);

  return displayProgress;
}

function ProgressPanel({
  job,
  onCancel,
}: {
  job: AuditJob | null;
  onCancel: () => void;
}) {
  const rawProgress = count(job?.progress);
  const smoothProgress = useSmoothProgress(rawProgress);
  const stage = friendlyStage(job?.stage, job?.status);

  return (
    <section className={styles.statusCard} aria-labelledby="status-title">
      <div className={styles.statusTop}>
        <div className={styles.stageColumn}>
          <p className={styles.statusLabel}>
            <span className={styles.activeDot} aria-hidden="true" />
            {job?.status === "queued"
              ? "Menunggu giliran"
              : "Pemeriksaan berjalan"}
          </p>
          <div className={styles.stageArea}>
            <h1 id="status-title" key={stage}>
              {stage}
            </h1>
          </div>
        </div>
        <strong className={styles.percent}>{smoothProgress}%</strong>
      </div>

      {/* Smooth Progress Bar with continuous shimmer and glowing head */}
      <div
        className={styles.progressBarWrapper}
        role="progressbar"
        aria-valuenow={smoothProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Kemajuan pemeriksaan: ${smoothProgress}%`}
      >
        <div
          className={styles.progressBarFill}
          style={{ width: `${Math.max(smoothProgress, 3)}%` }}
        >
          <span className={styles.progressBarGlow} aria-hidden="true" />
        </div>
      </div>

      <div className={styles.statusMeta}>
        <span>
          {job?.queuePosition
            ? `Urutan Anda saat ini: ${job.queuePosition}`
            : "Satu halaman diperiksa pada satu waktu"}
        </span>
        <span>Percobaan {Math.max(job?.attempts ?? 1, 1)} dari 2</span>
      </div>

      <p className={styles.statusNote}>
        Halaman ini boleh ditutup. Pemeriksaan tetap berjalan, dan hasilnya bisa
        dibuka lagi dari halaman Riwayat.
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
        <h2 id="comparison-title">Sebelum dan sesudah diperbaiki</h2>
        <strong className={styles.reduction}>{reduction}% berkurang</strong>
      </div>

      <div
        className={styles.chart}
        role="img"
        aria-label={`${before} hambatan sebelum diperbaiki dan ${after} hambatan setelah diperbaiki`}
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
          <caption>
            Rincian teknis: jumlah bagian bermasalah pada setiap aturan yang
            diperiksa
          </caption>
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
          Halaman ini adalah tampilan buatan AksaraNetra. Isinya tetap berasal
          dari situs aslinya, dan situs aslinya tidak diubah.
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
          Diperiksa {waktu(snapshot.capturedAt)} · Versi pemeriksaan{" "}
          {snapshot.engineVersion}
        </p>
      </header>

      <section
        className={styles.primaryActions}
        aria-labelledby="actions-title"
      >
        <div className={styles.actionsIntro}>
          <h2 id="actions-title">Baca hasilnya</h2>
          <p>
            Baca isi halaman dalam tampilan yang lebih sederhana dan lebih mudah
            digunakan dengan pembaca layar.
          </p>
        </div>
        <a
          className="btn btn-primary"
          href={links.reader}
          target="_blank"
          rel="noopener noreferrer"
        >
          Buka versi ramah akses
        </a>
        <a
          className="btn btn-secondary"
          href={links.reportPdf}
          target="_blank"
          rel="noopener noreferrer"
        >
          Unduh laporan
        </a>
        <a
          className="btn btn-secondary"
          href={links.patched}
          target="_blank"
          rel="noopener noreferrer"
        >
          Lihat halaman setelah perbaikan
        </a>
      </section>

      <section className={styles.metricGrid} aria-label="Ringkasan pemeriksaan">
        <article>
          <span>Hambatan ditemukan</span>
          <strong>
            <AngkaNaik value={count(snapshot.summary.beforeTotal)} />
          </strong>
        </article>
        <article>
          <span>Hambatan yang masih ada</span>
          <strong>
            <AngkaNaik value={count(snapshot.summary.afterTotal)} />
          </strong>
        </article>
        <article>
          <span>Berhasil diperbaiki</span>
          <strong>
            <AngkaNaik value={fixed} />
          </strong>
        </article>
        <article>
          <span>Perlu diperiksa orang</span>
          <strong>
            <AngkaNaik value={count(snapshot.counts.review)} />
          </strong>
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
          <h2 id="verification-title">Pemeriksaan ulang setelah perbaikan</h2>
          <span
            className={
              snapshot.warnings.wcagRegressionClean
                ? styles.goodBadge
                : styles.attentionBadge
            }
          >
            {snapshot.warnings.wcagRegressionClean
              ? "Tidak ada masalah baru setelah perbaikan"
              : "Masih perlu diperiksa lagi"}
          </span>
        </div>

        <div className={styles.verificationGrid}>
          <div>
            <strong>{fixed}</strong>
            <span>Berhasil diperbaiki</span>
          </div>
          <div>
            <strong>{rolledBack}</strong>
            <span>Dibatalkan karena tidak membantu</span>
          </div>
          <div>
            <strong>{skipped}</strong>
            <span>Belum dapat diperbaiki</span>
          </div>
        </div>

        <details className={styles.details}>
          <summary>Lihat rincian teknis</summary>
          <dl>
            <div>
              <dt>Jumlah hambatan benar benar menurun</dt>
              <dd>{snapshot.summary.strictImprovement ? "Ya" : "Tidak"}</dd>
            </div>
            <div>
              <dt>Masalah baru setelah perbaikan</dt>
              <dd>{snapshot.summary.noRegression ? "Tidak ada" : "Ada"}</dd>
            </div>
            <div>
              <dt>Perbaikan yang ditinjau orang</dt>
              <dd>{count(snapshot.counts.verifiedOverrides)}</dd>
            </div>
            <div>
              <dt>Tinjauan yang perlu diperbarui</dt>
              <dd>{snapshot.warnings.staleOverrides?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Perbaikan yang diperiksa satu per satu</dt>
              <dd>{fixed}</dd>
            </div>
            <div>
              <dt>Rincian pemeriksaan</dt>
              <dd>Ada di laporan yang bisa diunduh</dd>
            </div>
          </dl>
        </details>
      </section>

      <section className={styles.evidenceCard}>
        <div>
          <h2>Tangkapan halaman</h2>
          <p>
            Gambar ini memperlihatkan tampilan halaman setelah diperbaiki.
            Rincian lengkapnya ada di laporan yang bisa diunduh.
          </p>
        </div>
        <a
          className="btn btn-secondary"
          href={links.screenshot}
          target="_blank"
          rel="noopener noreferrer"
        >
          Lihat tangkapan halaman
        </a>
      </section>
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
    actionHref: "/",
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
              "Token pemeriksaan tidak ditemukan di perangkat ini. Jalankan pemeriksaan ulang.",
            actionLabel: "Periksa ulang",
            actionHref: "/periksa",
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
          message: "Mulai pemeriksaan baru.",
          actionLabel: "Periksa halaman",
          actionHref: "/periksa",
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
          setJob({
            ...response.job,
            progress: 100,
            stage: "Pemeriksaan selesai",
          });
          timer = setTimeout(() => {
            if (active) setPhase("ready");
          }, 800);
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
          <p>Ini hanya perlu beberapa saat.</p>
        </section>
      )}

      {phase === "cache-choice" && (
        <section className={styles.centerCard}>
          <h1>Ada hasil pemeriksaan sebelumnya</h1>
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
          <h1>Hasil pemeriksaan sudah siap</h1>
          <p>
            Di dalamnya ada ringkasan, tampilan ramah akses, dan laporan yang
            bisa diunduh.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => jobId && token && void loadResult(jobId, token)}
          >
            Baca hasil
          </button>
        </section>
      )}

      {phase === "loading-result" && (
        <section className={styles.centerCard} role="status">
          <div className={styles.spinner} aria-hidden="true" />
          <h1>Membuka hasil pemeriksaan</h1>
          <p>Ringkasan dan tampilan ramah akses sedang disiapkan.</p>
        </section>
      )}

      {phase === "cancelled" && (
        <section className={styles.centerCard}>
          <h1>Pemeriksaan dihentikan</h1>
          <p>Tidak ada hasil yang disimpan dari pemeriksaan ini.</p>
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
            <Link href={failure.actionHref} className="btn btn-primary">
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
            <h1>Membuka halaman pemeriksaan</h1>
          </section>
        </main>
      }
    >
      <ResultPageContent />
    </Suspense>
  );
}
