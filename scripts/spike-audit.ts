/**
 * Spike Teknis AksaraNetra
 * ─────────────────────────
 * 1. Jalankan axe-core pada 12 situs target
 * 2. Pilih 3 halaman paling stabil
 * 3. Ambil satu HTML dan render ulang dengan aset benar
 * 4. Terapkan 3 perbaikan aman
 * 5. Bandingkan hasil axe-core before/after
 * 
 * Usage: npx tsx scripts/spike-audit.ts
 */

import { validateUrl } from '../lib/security/urlValidator';
import { fetchPage } from '../lib/fetch/pageFetcher';
import { runAudit, compareAudits } from '../lib/audit/accessibilityAnalyzer';
import { remediate } from '../lib/remediation/engine';
import { prepareForDisplay } from '../lib/render/renderer';
import type { AuditResult } from '../lib/types';
import * as fs from 'fs';
import * as path from 'path';

// ─── 12 Situs Target ───
const TARGET_SITES = [
  { url: 'https://jakarta.go.id', name: 'DKI Jakarta' },
  { url: 'https://jabarprov.go.id', name: 'Jawa Barat' },
  { url: 'https://jatengprov.go.id', name: 'Jawa Tengah' },
  { url: 'https://jogjaprov.go.id', name: 'DI Yogyakarta' },
  { url: 'https://lampungprov.go.id', name: 'Lampung' },
  { url: 'https://bengkuluprov.go.id', name: 'Bengkulu' },
  { url: 'https://babelprov.go.id', name: 'Bangka Belitung' },
  { url: 'https://kepriprov.go.id', name: 'Kepulauan Riau' },
  { url: 'https://sulselprov.go.id', name: 'Sulawesi Selatan' },
  { url: 'https://www.sultengprov.go.id', name: 'Sulawesi Tengah' },
  { url: 'https://www.sulawesitenggaraprov.go.id', name: 'Sulawesi Tenggara' },
  { url: 'https://indonesia.go.id', name: 'Portal Nasional' },
];

// ─── Output directory ───
const OUTPUT_DIR = path.resolve(__dirname, '..', 'docs', 'spike-results');

interface SiteResult {
  name: string;
  url: string;
  fetchSuccess: boolean;
  fetchError?: string;
  usedBrowser: boolean;
  htmlSize: number;
  isJsHeavy: boolean;
  auditBefore: AuditResult | null;
  stabilityScore: number; // higher = more stable
}

function log(msg: string) {
  const timestamp = new Date().toLocaleTimeString('id-ID');
  console.log(`[${timestamp}] ${msg}`);
}

function divider() {
  console.log('─'.repeat(70));
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ═══════════════════════════════════════════════════════
  // LANGKAH 1: Audit 12 situs target
  // ═══════════════════════════════════════════════════════
  divider();
  log('LANGKAH 1: Mengaudit 12 situs target dengan axe-core...');
  divider();

  const results: SiteResult[] = [];

  for (const site of TARGET_SITES) {
    log(`\n📡 Memproses: ${site.name} (${site.url})`);

    // Validate URL
    const validation = await validateUrl(site.url);
    if (!validation.valid) {
      log(`  ❌ URL ditolak: ${validation.reason}`);
      results.push({
        name: site.name,
        url: site.url,
        fetchSuccess: false,
        fetchError: `validation_${validation.reason}`,
        usedBrowser: false,
        htmlSize: 0,
        isJsHeavy: false,
        auditBefore: null,
        stabilityScore: 0,
      });
      continue;
    }

    // Fetch page
    log(`  ⏳ Mengambil halaman...`);
    const fetchResult = await fetchPage(validation.url, { timeoutMs: 15000 });

    if (!fetchResult.success) {
      log(`  ❌ Gagal fetch: ${fetchResult.error}`);
      results.push({
        name: site.name,
        url: site.url,
        fetchSuccess: false,
        fetchError: fetchResult.error,
        usedBrowser: false,
        htmlSize: 0,
        isJsHeavy: false,
        auditBefore: null,
        stabilityScore: 0,
      });
      continue;
    }

    const htmlSize = fetchResult.html.length;
    const bodyMatch = fetchResult.html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyText = bodyMatch?.[1]
      ?.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, '') || '';
    const isJsHeavy = bodyText.length < 200;

    log(`  📄 HTML: ${(htmlSize / 1024).toFixed(1)} KB | Body text: ${bodyText.length} chars | JS-heavy: ${isJsHeavy}`);

    // Run axe-core audit
    log(`  🔍 Menjalankan axe-core audit...`);
    let auditBefore: AuditResult | null = null;
    try {
      auditBefore = await runAudit(fetchResult.html);
      log(`  📊 Hasil audit: ${auditBefore.totalCount} masalah ditemukan`);
      for (const issue of auditBefore.issues) {
        log(`     ├─ ${issue.ruleId}: ${issue.nodeCount} node (${issue.impact})`);
      }
    } catch (err: any) {
      log(`  ⚠️ Audit gagal: ${err.message}`);
    }

    // Calculate stability score
    // Higher = better: successful fetch + has content + audit ran
    let stabilityScore = 0;
    if (fetchResult.success) stabilityScore += 10;
    if (!isJsHeavy) stabilityScore += 5;
    if (htmlSize > 10000) stabilityScore += 3;
    if (bodyText.length > 500) stabilityScore += 3;
    if (auditBefore && auditBefore.totalCount > 0) stabilityScore += 2; // has issues to fix
    if (auditBefore) stabilityScore += 2;

    results.push({
      name: site.name,
      url: site.url,
      fetchSuccess: true,
      usedBrowser: fetchResult.usedBrowser,
      htmlSize,
      isJsHeavy,
      auditBefore,
      stabilityScore,
    });
  }

  // ═══════════════════════════════════════════════════════
  // LANGKAH 2: Pilih 3 halaman paling stabil
  // ═══════════════════════════════════════════════════════
  divider();
  log('\nLANGKAH 2: Memilih 3 halaman paling stabil...');
  divider();

  const ranked = [...results]
    .filter(r => r.fetchSuccess && r.auditBefore)
    .sort((a, b) => b.stabilityScore - a.stabilityScore);

  console.log('\n┌─────────────────────────────┬───────┬──────────┬────────┬────────────┐');
  console.log('│ Situs                       │ Skor  │ HTML (KB)│JS-heavy│Masalah axe │');
  console.log('├─────────────────────────────┼───────┼──────────┼────────┼────────────┤');

  for (const r of ranked) {
    const name = r.name.padEnd(27);
    const score = String(r.stabilityScore).padStart(5);
    const size = (r.htmlSize / 1024).toFixed(0).padStart(8);
    const jsHeavy = (r.isJsHeavy ? 'Ya' : 'Tidak').padStart(6);
    const issues = String(r.auditBefore?.totalCount ?? '-').padStart(10);
    console.log(`│ ${name} │${score} │${size} │${jsHeavy} │${issues} │`);
  }
  console.log('└─────────────────────────────┴───────┴──────────┴────────┴────────────┘');

  const top3 = ranked.slice(0, 3);
  log(`\n🏆 Top 3 paling stabil:`);
  top3.forEach((r, i) => log(`  ${i + 1}. ${r.name} (skor: ${r.stabilityScore}, masalah: ${r.auditBefore?.totalCount})`));

  if (top3.length === 0) {
    log('❌ Tidak ada situs yang berhasil diaudit. Spike dihentikan.');
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════
  // LANGKAH 3 & 4: Ambil situs #1, render ulang, terapkan perbaikan
  // ═══════════════════════════════════════════════════════
  divider();
  const targetSite = top3[0];
  log(`\nLANGKAH 3 & 4: Remediasi "${targetSite.name}" (${targetSite.url})`);
  divider();

  // Re-fetch to get fresh HTML
  log('⏳ Mengambil ulang halaman...');
  const freshFetch = await fetchPage(targetSite.url, { timeoutMs: 15000 });
  if (!freshFetch.success) {
    log(`❌ Gagal fetch ulang: ${freshFetch.error}`);
    process.exit(1);
  }

  const originalHtml = freshFetch.html;
  log(`📄 HTML asli: ${(originalHtml.length / 1024).toFixed(1)} KB`);

  // Save original HTML
  const originalPath = path.join(OUTPUT_DIR, 'original.html');
  fs.writeFileSync(originalPath, originalHtml, 'utf-8');
  log(`💾 HTML asli disimpan: ${originalPath}`);

  // Apply remediation (3 fixes)
  log('\n🔧 Menerapkan 3 perbaikan aksesibilitas...');
  const remediationResult = remediate(originalHtml);
  log(`  ✅ Link diperbaiki: ${remediationResult.fixed.filter(f => f.type === 'link_name').length}`);
  log(`  ✅ Button diperbaiki: ${remediationResult.fixed.filter(f => f.type === 'button_name').length}`);
  log(`  ✅ Scroll area diperbaiki: ${remediationResult.fixed.filter(f => f.type === 'scroll_keyboard').length}`);
  log(`  ⚠️ Manual review: ${remediationResult.manualReview.length} elemen`);

  // Show some fix examples
  const fixExamples = remediationResult.fixed.slice(0, 5);
  if (fixExamples.length > 0) {
    log('\n  📝 Contoh perbaikan:');
    for (const fix of fixExamples) {
      log(`     [${fix.type}] ${fix.selector} → aria-label="${fix.after}"`);
    }
    if (remediationResult.fixed.length > 5) {
      log(`     ... dan ${remediationResult.fixed.length - 5} perbaikan lainnya`);
    }
  }

  // Render with proper assets
  log('\n🎨 Merender ulang dengan aset yang benar...');
  const renderResult = prepareForDisplay(remediationResult, targetSite.url);
  log(`  📄 HTML hasil: ${(renderResult.safeHtml.length / 1024).toFixed(1)} KB`);
  log(`  🔒 Disclaimer dan skip link terinjeksi`);

  // Save remediated HTML
  const remediatedPath = path.join(OUTPUT_DIR, 'remediated.html');
  fs.writeFileSync(remediatedPath, renderResult.safeHtml, 'utf-8');
  log(`💾 HTML hasil disimpan: ${remediatedPath}`);

  // ═══════════════════════════════════════════════════════
  // LANGKAH 5: Bandingkan hasil axe-core
  // ═══════════════════════════════════════════════════════
  divider();
  log('\nLANGKAH 5: Membandingkan hasil axe-core before/after...');
  divider();

  log('🔍 Menjalankan audit pada HTML asli...');
  const auditBefore = await runAudit(originalHtml);
  log(`  📊 BEFORE: ${auditBefore.totalCount} masalah`);

  log('🔍 Menjalankan audit pada HTML hasil remediasi...');
  const auditAfter = await runAudit(renderResult.safeHtml);
  log(`  📊 AFTER: ${auditAfter.totalCount} masalah`);

  const comparison = compareAudits(auditBefore, auditAfter);

  console.log('\n┌──────────────────────────────────┬─────────┬─────────┬───────────┐');
  console.log('│ Rule                             │ Before  │ After   │ Perbaikan │');
  console.log('├──────────────────────────────────┼─────────┼─────────┼───────────┤');
  for (const d of comparison.details) {
    const rule = d.ruleId.padEnd(32);
    const before = String(d.before).padStart(7);
    const after = String(d.after).padStart(7);
    const improvement = String(d.before - d.after).padStart(9);
    console.log(`│ ${rule} │${before} │${after} │${improvement} │`);
  }
  console.log('├──────────────────────────────────┼─────────┼─────────┼───────────┤');
  const totalBefore = String(comparison.beforeTotal).padStart(7);
  const totalAfter = String(comparison.afterTotal).padStart(7);
  const totalImprovement = String(comparison.improvement).padStart(9);
  console.log(`│ TOTAL                            │${totalBefore} │${totalAfter} │${totalImprovement} │`);
  console.log('└──────────────────────────────────┴─────────┴─────────┴───────────┘');

  const improvementPct = comparison.beforeTotal > 0
    ? ((comparison.improvement / comparison.beforeTotal) * 100).toFixed(1)
    : '0';
  log(`\n📈 Perbaikan: ${comparison.beforeTotal} → ${comparison.afterTotal} (${improvementPct}% berkurang)`);

  // ═══════════════════════════════════════════════════════
  // Save full report
  // ═══════════════════════════════════════════════════════
  const report = {
    timestamp: new Date().toISOString(),
    targetSite: { name: targetSite.name, url: targetSite.url },
    allSitesAudit: results.map(r => ({
      name: r.name,
      url: r.url,
      fetchSuccess: r.fetchSuccess,
      fetchError: r.fetchError,
      htmlSize: r.htmlSize,
      isJsHeavy: r.isJsHeavy,
      stabilityScore: r.stabilityScore,
      issueCount: r.auditBefore?.totalCount ?? null,
      issues: r.auditBefore?.issues ?? [],
    })),
    top3: top3.map(r => ({ name: r.name, url: r.url, score: r.stabilityScore })),
    remediation: {
      fixedCount: remediationResult.fixed.length,
      manualReviewCount: remediationResult.manualReview.length,
      fixesByType: {
        link_name: remediationResult.fixed.filter(f => f.type === 'link_name').length,
        button_name: remediationResult.fixed.filter(f => f.type === 'button_name').length,
        scroll_keyboard: remediationResult.fixed.filter(f => f.type === 'scroll_keyboard').length,
      },
      fixes: remediationResult.fixed,
      manualReview: remediationResult.manualReview,
    },
    comparison: {
      before: auditBefore,
      after: auditAfter,
      details: comparison,
      improvementPercent: parseFloat(improvementPct),
    },
  };

  const reportPath = path.join(OUTPUT_DIR, 'spike-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  log(`\n💾 Laporan lengkap disimpan: ${reportPath}`);

  // ═══════════════════════════════════════════════════════
  // LANGKAH 6: Instruksi NVDA & keyboard testing
  // ═══════════════════════════════════════════════════════
  divider();
  log('\nLANGKAH 6: Uji dengan NVDA dan Keyboard');
  divider();
  console.log(`
📋 Buka file hasil remediasi di browser:
   file://${remediatedPath.replace(/\\/g, '/')}

🔑 Checklist Keyboard Testing:
   [ ] Tab melalui semua link — pastikan focus indicator terlihat
   [ ] Tab melalui semua button — pastikan focus indicator terlihat
   [ ] Tab ke scroll area — pastikan bisa scroll dengan arrow keys
   [ ] Skip link muncul saat Tab pertama kali
   [ ] Tidak ada keyboard trap

🔊 Checklist NVDA Testing:
   [ ] NVDA membacakan disclaimer di awal
   [ ] Skip link berfungsi (langsung ke konten utama)
   [ ] Semua link yang diperbaiki terbaca label-nya
   [ ] Semua button yang diperbaiki terbaca label-nya
   [ ] Heading hierarchy terstruktur saat navigasi H

✅ Spike selesai!
`);

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Spike gagal:', err);
  process.exit(1);
});
