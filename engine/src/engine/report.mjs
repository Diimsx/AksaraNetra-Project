export function countRuleNodes(axeResult, ruleId) {
  return (
    axeResult?.violations?.find((violation) => violation.id === ruleId)
      ?.nodes.length ?? 0
  );
}

export function createMetrics(before, after, ruleIds) {
  const rules = Object.fromEntries(
    ruleIds.map((ruleId) => {
      const beforeNodes = countRuleNodes(before, ruleId);
      const afterNodes = countRuleNodes(after, ruleId);
      const reduction = beforeNodes - afterNodes;
      const reductionPercent = beforeNodes
        ? Math.round((reduction / beforeNodes) * 10_000) / 100
        : 0;

      return [
        ruleId,
        {
          before: beforeNodes,
          after: afterNodes,
          reduction,
          reductionPercent,
        },
      ];
    }),
  );

  const beforeTotal = Object.values(rules).reduce(
    (total, item) => total + item.before,
    0,
  );
  const afterTotal = Object.values(rules).reduce(
    (total, item) => total + item.after,
    0,
  );

  return {
    rules,
    beforeTotal,
    afterTotal,
    reduction: beforeTotal - afterTotal,
    reductionPercent: beforeTotal
      ? Math.round(((beforeTotal - afterTotal) / beforeTotal) * 10_000) / 100
      : 0,
    strictImprovement: afterTotal < beforeTotal,
    noRegression: Object.values(rules).every(
      (item) => item.after <= item.before,
    ),
  };
}

/**
 * Membandingkan dua pemindaian axe pada SELURUH rule, bukan hanya rule target.
 *
 * createMetrics sengaja hanya mengukur tiga rule yang kita perbaiki. Fungsi
 * ini melengkapinya: memastikan patch kita tidak diam-diam merusak rule lain
 * seperti aria-allowed-attr, landmark, atau duplicate-id.
 *
 * Catatan jujur: halaman berita itu dinamis. Carousel berputar dan angka bisa
 * bergeser sedikit antara dua pemindaian tanpa ada hubungannya dengan patch.
 * Jadi laporan ini petunjuk kuat, bukan bukti matematis.
 */
export function createRegressionReport(before, after) {
  const ruleIds = new Set([
    ...(before?.violations ?? []).map((violation) => violation.id),
    ...(after?.violations ?? []).map((violation) => violation.id),
  ]);

  const rules = {};
  for (const ruleId of [...ruleIds].sort()) {
    const beforeNodes = countRuleNodes(before, ruleId);
    const afterNodes = countRuleNodes(after, ruleId);
    rules[ruleId] = {
      before: beforeNodes,
      after: afterNodes,
      delta: afterNodes - beforeNodes,
    };
  }

  const worsened = Object.entries(rules)
    .filter(([, item]) => item.delta > 0)
    .map(([ruleId, item]) => ({ ruleId, ...item }))
    .sort((a, b) => b.delta - a.delta);

  const newRules = worsened
    .filter((item) => item.before === 0)
    .map((item) => item.ruleId);

  return {
    rules,
    worsened,
    newViolationRules: newRules,
    clean: worsened.length === 0,
  };
}

/**
 * Mencari nama aksesibilitas yang kembar di antara elemen yang sudah dipatch.
 *
 * Nama kembar itu lolos axe tetapi menyusahkan pengguna nyata. Pengguna NVDA
 * yang menekan B untuk lompat antar tombol akan mendengar "Media sebelumnya"
 * empat kali tanpa tahu mana yang mana.
 *
 * Ini dilaporkan sebagai peringatan, bukan kegagalan. Menyelesaikannya butuh
 * konteks section yang belum kita punya, dan kita tidak mau mengarang.
 */
export function findDuplicateLabels(records = []) {
  const groups = new Map();

  for (const record of records) {
    const label = record.patches?.find(
      (patch) => patch.attribute === "aria-label",
    )?.value;
    if (!label) continue;

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(record.selector);
  }

  return [...groups.entries()]
    .filter(([, selectors]) => selectors.length > 1)
    .map(([label, selectors]) => ({
      label,
      count: selectors.length,
      selectors,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
