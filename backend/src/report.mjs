const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function rows(records = []) {
  if (!records.length) return "<p>Tidak ada.</p>";
  return `<table><thead><tr><th>Rule</th><th>Elemen</th><th>Status</th><th>Confidence</th></tr></thead><tbody>${records.map((item) => `<tr><td>${esc(item.rule)}</td><td><code>${esc(item.selector)}</code></td><td>${esc(item.status)}</td><td>${esc(item.confidence)}</td></tr>`).join("")}</tbody></table>`;
}

export function renderAuditReport({ snapshot, report }) {
  const summary = snapshot.summary || {};
  const title = snapshot.source?.title || "Laporan audit AksaraNetra";
  const regression = snapshot.warnings?.worsenedRules || [];
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:11pt/1.55 Arial,sans-serif;color:#172033}h1{font-size:22pt}h2{margin-top:22pt;border-bottom:2px solid #294f91;padding-bottom:4pt}a{color:#0b3d91}code{font:9pt Consolas,monospace;overflow-wrap:anywhere}.meta,.cards{display:grid;grid-template-columns:repeat(2,1fr);gap:10pt}.card{border:1px solid #aab4c5;border-radius:6pt;padding:10pt}.number{font-size:20pt;font-weight:700}table{border-collapse:collapse;width:100%;font-size:9pt}th,td{border:1px solid #aab4c5;padding:6pt;text-align:left;vertical-align:top}th{background:#edf2fb}.ok{color:#176b37}.warn{color:#8a4b08}footer{margin-top:24pt;border-top:1px solid #aab4c5;padding-top:8pt;font-size:9pt}
</style></head><body><header><p>AksaraNetra · Engine ${esc(snapshot.engineVersion)}</p><h1>${esc(title)}</h1><p>${esc(snapshot.disclaimer)}</p></header>
<section class="meta"><div><strong>Sumber</strong><br>${esc(snapshot.source?.finalUrl)}</div><div><strong>Waktu audit</strong><br>${esc(snapshot.capturedAt)}</div></section>
<h2>Ringkasan</h2><section class="cards"><div class="card"><div class="number">${esc(summary.beforeTotal)}</div>Temuan target sebelum</div><div class="card"><div class="number">${esc(summary.afterTotal)}</div>Temuan target setelah</div><div class="card"><div class="number">${esc(snapshot.counts?.fixed)}</div>Patch terverifikasi</div><div class="card"><div class="number">${esc(summary.reductionPercent)}%</div>Pengurangan</div></section>
<h2>Status verifikasi</h2><p class="${snapshot.warnings?.wcagRegressionClean ? "ok" : "warn"}">${snapshot.warnings?.wcagRegressionClean ? "Tidak ada rule WCAG luas yang memburuk." : "Ada perubahan yang perlu ditinjau pada pemindaian WCAG luas."}</p>${regression.length ? `<pre>${esc(JSON.stringify(regression, null, 2))}</pre>` : ""}
<h2>Patch terverifikasi</h2>${rows(report.fixed)}
<h2>Perlu review manusia</h2>${rows(report.review)}
<h2>Patch yang dibatalkan</h2>${rows(report.rolledBackRecords)}
<footer>Laporan dibuat otomatis. Hasil ini tidak menyatakan situs asli telah diperbaiki dan tidak menggantikan pengujian manual dengan teknologi bantu.</footer></body></html>`;
}
