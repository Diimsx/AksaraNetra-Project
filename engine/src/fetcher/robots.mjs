/**
 * Pembaca robots.txt sesuai RFC 9309.
 *
 * Murni: menerima teks, bukan URL. Pengambilan berkasnya dikerjakan pemanggil,
 * sehingga aturan pencocokannya tetap bisa diuji tanpa jaringan.
 *
 * Aturan penting yang diikuti:
 * - Baris user-agent berurutan berbagi satu kelompok aturan.
 * - Pola terpanjang yang cocok menang.
 * - Kalau panjangnya sama, Allow menang atas Disallow.
 * - "Disallow:" tanpa nilai tidak melarang apa pun.
 */

export const ROBOTS_USER_AGENT = "AksaraNetra-Accessibility";

/**
 * Mengubah isi robots.txt menjadi daftar kelompok aturan.
 */
export function parseRobots(text = "") {
  const groups = [];
  let current = null;
  let collectingAgents = false;

  for (const line of String(text ?? "").split(/\r?\n/)) {
    const withoutComment = line.split("#")[0].trim();
    if (!withoutComment) continue;

    const separator = withoutComment.indexOf(":");
    if (separator === -1) continue;

    const field = withoutComment.slice(0, separator).trim().toLowerCase();
    const value = withoutComment.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!collectingAgents || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
        collectingAgents = true;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    if (field === "allow" || field === "disallow") {
      if (!current) continue;
      collectingAgents = false;
      current.rules.push({ allow: field === "allow", path: value });
    }
  }

  return groups;
}

/**
 * Memilih kelompok aturan yang berlaku untuk sebuah user agent.
 *
 * Nama yang paling spesifik menang. Kalau tidak ada yang cocok, kelompok
 * bintang dipakai.
 */
function selectGroup(groups, userAgent) {
  const needle = String(userAgent ?? "").toLowerCase();

  let best = null;
  let bestLength = -1;
  let wildcard = null;

  for (const group of groups) {
    for (const agent of group.agents) {
      if (agent === "*") {
        if (!wildcard) wildcard = group;
        continue;
      }
      if (agent && needle.includes(agent) && agent.length > bestLength) {
        best = group;
        bestLength = agent.length;
      }
    }
  }

  return best || wildcard || null;
}

/**
 * Mencocokkan pola robots.txt dengan sebuah path.
 * Mendukung bintang sebagai pengganti apa pun dan tanda dolar sebagai penanda
 * akhir path.
 */
export function pathMatches(pattern, target) {
  if (!pattern) return false;

  let anchored = false;
  let source = pattern;

  if (source.endsWith("$")) {
    anchored = true;
    source = source.slice(0, -1);
  }

  const pieces = source.split("*");
  const first = pieces[0];

  if (!target.startsWith(first)) return false;
  let cursor = first.length;

  for (let index = 1; index < pieces.length; index += 1) {
    const piece = pieces[index];
    if (piece === "") continue;

    const found = target.indexOf(piece, cursor);
    if (found === -1) return false;
    cursor = found + piece.length;
  }

  if (anchored) {
    const last = pieces[pieces.length - 1];
    if (last === "") return true;
    return target.endsWith(last);
  }

  return true;
}

/**
 * Menentukan apakah sebuah path boleh diambil.
 */
export function isAllowed(groups, path, userAgent = ROBOTS_USER_AGENT) {
  const group = selectGroup(groups, userAgent);
  if (!group) return { allowed: true, rule: null };

  let winner = null;

  for (const rule of group.rules) {
    if (rule.path === "") continue;
    if (!pathMatches(rule.path, path)) continue;

    const longer = !winner || rule.path.length > winner.path.length;
    const tieBreak =
      winner && rule.path.length === winner.path.length && rule.allow && !winner.allow;

    if (longer || tieBreak) winner = rule;
  }

  if (!winner) return { allowed: true, rule: null };
  return { allowed: winner.allow, rule: winner };
}

/**
 * Menerjemahkan status pengambilan robots.txt menjadi keputusan.
 *
 * Konvensi yang dipakai mesin pencari: berkas tidak ada berarti bebas, dan
 * kesalahan server berarti sebaiknya berhenti. Kita memilih sikap hati-hati.
 */
export function decideOnRobotsStatus(status) {
  const code = Number(status);

  if (code >= 200 && code <= 299) return { usable: true, allowAll: false };
  if (code === 404 || code === 410) return { usable: false, allowAll: true };
  if (code === 401 || code === 403) return { usable: false, allowAll: false };
  if (code >= 500) return { usable: false, allowAll: false };

  return { usable: false, allowAll: true };
}

/**
 * Pemeriksaan lengkap untuk satu URL.
 */
export function checkRobots({
  text = "",
  status = 200,
  url,
  userAgent = ROBOTS_USER_AGENT,
} = {}) {
  const decision = decideOnRobotsStatus(status);

  if (!decision.usable) {
    return decision.allowAll
      ? { ok: true, code: null, message: null, reason: "robots-absent" }
      : {
          ok: false,
          code: "robots-unavailable",
          message: `robots.txt tidak dapat dibaca, status ${status}. Aksara Netra memilih berhenti.`,
        };
  }

  let path = "/";
  try {
    const parsed = new URL(url);
    path = `${parsed.pathname}${parsed.search}`;
  } catch {
    path = "/";
  }

  const verdict = isAllowed(parseRobots(text), path, userAgent);

  if (verdict.allowed) {
    return { ok: true, code: null, message: null, reason: "robots-allowed" };
  }

  return {
    ok: false,
    code: "robots-disallowed",
    message: `robots.txt melarang pengambilan ${path}.`,
    rule: verdict.rule,
  };
}
