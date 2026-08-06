/**
 * Quick retest: Jalankan ulang spike pada DKI Jakarta saja
 * untuk verifikasi fix scroll detection + SVG context preservation
 */
import { fetchPage } from '../lib/fetch/pageFetcher';
import { runAudit, compareAudits } from '../lib/audit/accessibilityAnalyzer';
import { remediate } from '../lib/remediation/engine';
import { prepareForDisplay } from '../lib/render/renderer';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.resolve(__dirname, '..', 'docs', 'spike-results');

async function main() {
  console.log('=== Re-test: DKI Jakarta (setelah fix) ===\n');

  // Fetch
  console.log('1. Fetching jakarta.go.id...');
  const fetchResult = await fetchPage('https://jakarta.go.id', { timeoutMs: 15000 });
  if (!fetchResult.success) {
    console.error('Fetch gagal:', fetchResult.error);
    process.exit(1);
  }
  console.log(`   HTML: ${(fetchResult.html.length / 1024).toFixed(1)} KB\n`);

  // Audit BEFORE
  console.log('2. Audit BEFORE (HTML asli)...');
  const auditBefore = await runAudit(fetchResult.html);
  console.log(`   Total masalah: ${auditBefore.totalCount}`);
  for (const issue of auditBefore.issues) {
    console.log(`   - ${issue.ruleId}: ${issue.nodeCount} node (${issue.impact})`);
  }

  // Remediate
  console.log('\n3. Menerapkan remediasi...');
  const remResult = remediate(fetchResult.html);
  const linkFixes = remResult.fixed.filter(f => f.type === 'link_name').length;
  const buttonFixes = remResult.fixed.filter(f => f.type === 'button_name').length;
  const scrollFixes = remResult.fixed.filter(f => f.type === 'scroll_keyboard').length;
  console.log(`   Link diperbaiki: ${linkFixes}`);
  console.log(`   Button diperbaiki: ${buttonFixes}`);
  console.log(`   Scroll area diperbaiki: ${scrollFixes}`);
  console.log(`   Manual review: ${remResult.manualReview.length}`);
  console.log(`   Total fixed: ${remResult.fixed.length}`);

  // Render
  console.log('\n4. Merender dengan aset yang benar...');
  const renderResult = prepareForDisplay(remResult, 'https://jakarta.go.id');
  console.log(`   HTML hasil: ${(renderResult.safeHtml.length / 1024).toFixed(1)} KB`);

  // Save
  fs.writeFileSync(path.join(OUTPUT_DIR, 'remediated-v2.html'), renderResult.safeHtml, 'utf-8');

  // Audit AFTER
  console.log('\n5. Audit AFTER (HTML remediated)...');
  const auditAfter = await runAudit(renderResult.safeHtml);
  console.log(`   Total masalah: ${auditAfter.totalCount}`);
  for (const issue of auditAfter.issues) {
    console.log(`   - ${issue.ruleId}: ${issue.nodeCount} node (${issue.impact})`);
  }

  // Compare
  const cmp = compareAudits(auditBefore, auditAfter);
  console.log('\n=== PERBANDINGAN ===');
  console.log(`   BEFORE: ${cmp.beforeTotal} masalah`);
  console.log(`   AFTER:  ${cmp.afterTotal} masalah`);
  console.log(`   DELTA:  ${cmp.improvement > 0 ? '-' : '+'}${Math.abs(cmp.improvement)} (${cmp.improvement > 0 ? 'MEMBAIK' : cmp.improvement === 0 ? 'SAMA' : 'REGRESI'})`);
  
  for (const d of cmp.details) {
    const delta = d.before - d.after;
    const sign = delta > 0 ? '✅' : delta < 0 ? '❌' : '➖';
    console.log(`   ${sign} ${d.ruleId}: ${d.before} → ${d.after} (${delta >= 0 ? '-' : '+'}${Math.abs(delta)})`);
  }

  const pct = cmp.beforeTotal > 0 ? ((cmp.improvement / cmp.beforeTotal) * 100).toFixed(1) : '0';
  console.log(`\n📈 Improvement: ${pct}%`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
