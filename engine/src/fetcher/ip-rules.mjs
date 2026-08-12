/**
 * Klasifikasi alamat IP.
 *
 * Murni: tanpa jaringan, tanpa DNS, tanpa efek samping. Semua daftar di sini
 * mengacu pada blok khusus yang ditetapkan IANA, bukan tebakan.
 *
 * Dipakai gerbang keamanan untuk menolak alamat yang mengarah ke dalam
 * jaringan kita sendiri, ke laptop server, atau ke endpoint metadata cloud.
 */

const IPV4_SHAPE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * Blok IPv4 yang tidak boleh dihubungi.
 * Bentuknya [alamat awal, panjang prefix, alasan yang bisa dibaca manusia].
 */
const BLOCKED_IPV4 = [
  ["0.0.0.0", 8, "blok jaringan ini sendiri"],
  ["10.0.0.0", 8, "jaringan privat"],
  ["100.64.0.0", 10, "blok carrier grade NAT"],
  ["127.0.0.0", 8, "loopback"],
  ["169.254.0.0", 16, "link-local, termasuk endpoint metadata cloud"],
  ["172.16.0.0", 12, "jaringan privat"],
  ["192.0.0.0", 24, "blok khusus protokol IETF"],
  ["192.0.2.0", 24, "blok dokumentasi TEST-NET-1"],
  ["192.168.0.0", 16, "jaringan privat"],
  ["198.18.0.0", 15, "blok benchmarking"],
  ["198.51.100.0", 24, "blok dokumentasi TEST-NET-2"],
  ["203.0.113.0", 24, "blok dokumentasi TEST-NET-3"],
  ["224.0.0.0", 4, "multicast"],
  ["240.0.0.0", 4, "blok cadangan"],
];

const BLOCKED_IPV6 = [
  { match: (g) => g.every((part) => part === 0), reason: "alamat tidak ditentukan" },
  {
    match: (g) => g.slice(0, 7).every((part) => part === 0) && g[7] === 1,
    reason: "loopback",
  },
  { match: (g) => (g[0] & 0xfe00) === 0xfc00, reason: "unique local" },
  { match: (g) => (g[0] & 0xffc0) === 0xfe80, reason: "link-local" },
  { match: (g) => (g[0] & 0xff00) === 0xff00, reason: "multicast" },
  {
    match: (g) => g[0] === 0x2001 && g[1] === 0x0db8,
    reason: "blok dokumentasi",
  },
];

/**
 * Membaca alamat IPv4 dalam bentuk titik empat bagian.
 *
 * Nol di depan ditolak. "010.0.0.1" bisa ditafsirkan sebagai oktal oleh
 * pustaka lain, dan perbedaan tafsir seperti itu adalah celah klasik.
 */
export function parseIpv4(value) {
  const match = IPV4_SHAPE.exec(String(value ?? "").trim());
  if (!match) return null;

  const parts = [];
  for (let index = 1; index <= 4; index += 1) {
    const raw = match[index];
    if (raw.length > 1 && raw.startsWith("0")) return null;
    const number = Number(raw);
    if (number > 255) return null;
    parts.push(number);
  }

  return parts;
}

function ipv4ToNumber(parts) {
  return (
    parts[0] * 0x1000000 + parts[1] * 0x10000 + parts[2] * 0x100 + parts[3]
  );
}

function insideBlock(parts, base, prefix) {
  const start = ipv4ToNumber(parseIpv4(base));
  const size = 2 ** (32 - prefix);
  const value = ipv4ToNumber(parts);
  return value >= start && value < start + size;
}

/**
 * Membaca alamat IPv6, termasuk bentuk ringkas dengan "::" dan bentuk yang
 * menempelkan alamat IPv4 di ekornya.
 */
export function parseIpv6(value) {
  let text = String(value ?? "")
    .trim()
    .toLowerCase();

  if (text.startsWith("[") && text.endsWith("]")) text = text.slice(1, -1);

  const zone = text.indexOf("%");
  if (zone !== -1) text = text.slice(0, zone);
  if (!text.includes(":")) return null;

  let embeddedIpv4 = null;
  if (text.includes(".")) {
    const cut = text.lastIndexOf(":");
    embeddedIpv4 = parseIpv4(text.slice(cut + 1));
    if (!embeddedIpv4) return null;

    const high = embeddedIpv4[0] * 256 + embeddedIpv4[1];
    const low = embeddedIpv4[2] * 256 + embeddedIpv4[3];
    text = `${text.slice(0, cut + 1)}${high.toString(16)}:${low.toString(16)}`;
  }

  const marker = text.indexOf("::");
  let head = [];
  let tail = [];

  if (marker === -1) {
    head = text.split(":");
    if (head.length !== 8) return null;
  } else {
    if (text.indexOf("::", marker + 1) !== -1) return null;
    const left = text.slice(0, marker);
    const right = text.slice(marker + 2);
    head = left === "" ? [] : left.split(":");
    tail = right === "" ? [] : right.split(":");
    if (head.length + tail.length > 7) return null;
  }

  const fill = 8 - head.length - tail.length;
  if (marker !== -1 && fill < 1) return null;

  const groups = [];
  for (const piece of [...head, ...new Array(fill).fill("0"), ...tail]) {
    if (!/^[0-9a-f]{1,4}$/.test(piece)) return null;
    groups.push(Number.parseInt(piece, 16));
  }

  if (groups.length !== 8) return null;
  return { groups, embeddedIpv4 };
}

function groupsToIpv4(groups) {
  return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff];
}

/**
 * Mencari alamat IPv4 yang dibungkus di dalam alamat IPv6.
 *
 * Ini penting. "::ffff:127.0.0.1" adalah loopback yang menyamar, dan
 * pemeriksaan IPv6 biasa tidak menangkapnya.
 */
function embeddedFromGroups(groups) {
  const leadingZero = groups.slice(0, 5).every((part) => part === 0);

  if (!leadingZero) {
    const isNat64 =
      groups[0] === 0x0064 &&
      groups[1] === 0xff9b &&
      groups.slice(2, 6).every((part) => part === 0);
    return isNat64 ? groupsToIpv4(groups) : null;
  }

  if (groups[5] === 0xffff) return groupsToIpv4(groups);

  const isCompatible =
    groups[5] === 0 && (groups[6] !== 0 || groups[7] > 1);
  return isCompatible ? groupsToIpv4(groups) : null;
}

function classifyIpv4(parts) {
  for (const [base, prefix, reason] of BLOCKED_IPV4) {
    if (insideBlock(parts, base, prefix)) {
      return { version: 4, allowed: false, reason };
    }
  }
  return { version: 4, allowed: true, reason: null };
}

/**
 * Menentukan apakah sebuah alamat IP boleh dihubungi.
 *
 * @returns {{ version: 4|6|null, allowed: boolean, reason: string|null }}
 */
export function classifyIp(value) {
  const asIpv4 = parseIpv4(value);
  if (asIpv4) return classifyIpv4(asIpv4);

  const asIpv6 = parseIpv6(value);
  if (asIpv6) {
    const embedded = asIpv6.embeddedIpv4 || embeddedFromGroups(asIpv6.groups);

    if (embedded) {
      const nested = classifyIpv4(embedded);
      if (!nested.allowed) {
        return {
          version: 6,
          allowed: false,
          reason: `${nested.reason}, dibungkus dalam alamat IPv6`,
        };
      }
    }

    for (const rule of BLOCKED_IPV6) {
      if (rule.match(asIpv6.groups)) {
        return { version: 6, allowed: false, reason: rule.reason };
      }
    }

    return { version: 6, allowed: true, reason: null };
  }

  return {
    version: null,
    allowed: false,
    reason: "bukan alamat IP yang dapat dibaca",
  };
}

export function isLiteralIp(value) {
  return Boolean(parseIpv4(value) || parseIpv6(value));
}
