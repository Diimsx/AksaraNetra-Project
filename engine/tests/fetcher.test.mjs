import test from "node:test";
import assert from "node:assert/strict";

import { classifyIp, parseIpv4, parseIpv6 } from "../src/fetcher/ip-rules.mjs";
import {
  checkRedirect,
  checkResolvedAddresses,
  checkResponse,
  checkUrl,
} from "../src/fetcher/url-policy.mjs";
import {
  checkRobots,
  isAllowed,
  parseRobots,
} from "../src/fetcher/robots.mjs";
import { CATALOG, isExcluded, listDemoSites } from "../src/config/catalog.mjs";

test("reads plain IPv4 and refuses digits with a leading zero", () => {
  assert.deepEqual(parseIpv4("8.8.8.8"), [8, 8, 8, 8]);
  assert.deepEqual(parseIpv4("255.255.255.255"), [255, 255, 255, 255]);

  // "010" can be read as octal 8 by other libraries. A disagreement between
  // two parsers is exactly how a blocklist gets bypassed.
  assert.equal(parseIpv4("010.0.0.1"), null);
  assert.equal(parseIpv4("256.1.1.1"), null);
  assert.equal(parseIpv4("127.1"), null);
});

test("blocks every IPv4 range that points back inside our own network", () => {
  const blocked = [
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
  ];

  for (const address of blocked) {
    const verdict = classifyIp(address);
    assert.equal(verdict.allowed, false, `${address} should be blocked`);
    assert.ok(verdict.reason, `${address} should explain why`);
  }

  // 172.32.0.1 sits just outside the private block and must stay allowed.
  for (const address of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "103.10.0.1"]) {
    assert.equal(classifyIp(address).allowed, true, `${address} should pass`);
  }
});

test("reads shortened IPv6 and blocks the local ranges", () => {
  assert.deepEqual(parseIpv6("::1").groups, [0, 0, 0, 0, 0, 0, 0, 1]);
  assert.equal(parseIpv6("2606:4700:4700::1111").groups[0], 0x2606);
  assert.equal(parseIpv6("1:2:3"), null);
  assert.equal(parseIpv6("::1::2"), null);

  for (const address of ["::", "::1", "fd00::1", "fe80::1", "ff02::1", "2001:db8::1"]) {
    assert.equal(classifyIp(address).allowed, false, `${address} should be blocked`);
  }

  assert.equal(classifyIp("2606:4700:4700::1111").allowed, true);
});

test("unwraps an IPv4 address hidden inside an IPv6 address", () => {
  // This is the classic bypass. A plain IPv6 check does not see the loopback.
  const mapped = classifyIp("::ffff:127.0.0.1");
  assert.equal(mapped.allowed, false);
  assert.match(mapped.reason, /loopback/);

  // Same address written in hexadecimal instead of dotted form.
  assert.equal(classifyIp("::ffff:7f00:1").allowed, false);

  // The cloud metadata endpoint, wrapped.
  assert.equal(classifyIp("::ffff:169.254.169.254").allowed, false);

  // NAT64 wrapping a private address.
  assert.equal(classifyIp("64:ff9b::10.0.0.1").allowed, false);

  // A wrapped public address is still fine.
  assert.equal(classifyIp("::ffff:8.8.8.8").allowed, true);
});

test("accepts an ordinary public page address", () => {
  for (const input of [
    "https://sulselprov.go.id",
    "https://kepriprov.go.id/berita",
    "http://example.co.id:80/a/b?c=d",
    "https://example.com:443",
  ]) {
    assert.equal(checkUrl(input).ok, true, `${input} should be accepted`);
  }

  // The fragment never reaches the server, so we drop it.
  assert.equal(
    checkUrl("https://sulselprov.go.id/berita#isi").url,
    "https://sulselprov.go.id/berita",
  );
});

test("refuses addresses that are not a public web page", () => {
  const cases = [
    ["", "empty-url"],
    ["ftp://example.com", "protocol-not-allowed"],
    ["file:///etc/passwd", "protocol-not-allowed"],
    ["javascript:alert(1)", "protocol-not-allowed"],
    ["https://user:secret@example.com", "credentials-in-url"],
    ["https://example.com:8080", "port-not-allowed"],
    ["https://example.com:22", "port-not-allowed"],
    ["http://localhost/", "local-host-name"],
    ["http://printer.local/", "local-host-name"],
    ["http://127.0.0.1/", "ip-literal-not-allowed"],
    ["http://8.8.8.8/", "ip-literal-not-allowed"],
    ["http://[::1]/", "ip-literal-not-allowed"],
    // Verified against the runtime, not assumed: Node already rewrites all
    // four of these into 127.0.0.1, so they reach us as a loopback literal.
    ["http://2130706433/", "ip-literal-not-allowed"],
    ["http://127.1/", "ip-literal-not-allowed"],
    ["http://0x7f000001/", "ip-literal-not-allowed"],
    ["http://017700000001/", "ip-literal-not-allowed"],
    // A single label with no dot is not a public domain name.
    ["http://intranet/", "hostname-not-allowed"],
  ];

  for (const [input, code] of cases) {
    const verdict = checkUrl(input);
    assert.equal(verdict.ok, false, `${input} should be refused`);
    assert.equal(verdict.code, code, `${input} gave the wrong reason`);
    assert.ok(verdict.message.length > 0, `${input} should explain itself`);
  }
});

test("refuses the whole domain when only one resolved address is private", () => {
  assert.equal(checkResolvedAddresses(["103.10.0.1", "1.1.1.1"]).ok, true);
  assert.equal(checkResolvedAddresses([]).ok, false);

  // A domain can answer with several addresses. One private answer is enough
  // to make the whole request unsafe.
  const mixed = checkResolvedAddresses(["103.10.0.1", "127.0.0.1"]);
  assert.equal(mixed.ok, false);
  assert.equal(mixed.code, "blocked-address");
  assert.equal(mixed.address, "127.0.0.1");
});

test("checks every redirect again instead of trusting the first address", () => {
  // A public host that forwards to loopback is the usual way past a gate that
  // only inspects the address the user typed.
  const hop = checkRedirect({ to: "http://127.0.0.1/admin", hop: 1 });
  assert.equal(hop.ok, false);
  assert.equal(hop.code, "redirect-ip-literal-not-allowed");

  assert.equal(checkRedirect({ to: "https://sulselprov.go.id/x", hop: 3 }).ok, true);

  const looping = checkRedirect({ to: "https://sulselprov.go.id", hop: 9 });
  assert.equal(looping.ok, false);
  assert.equal(looping.code, "too-many-redirects");
});

test("never reports a non 2xx page as a finished audit", () => {
  assert.equal(checkResponse({ status: 200, contentType: "text/html; charset=utf-8" }).ok, true);

  const forbidden = checkResponse({ status: 403, contentType: "text/html" });
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.code, "access-denied");

  assert.equal(checkResponse({ status: 404 }).code, "status-not-ok");
  assert.equal(checkResponse({ status: 500 }).code, "status-not-ok");
  assert.equal(
    checkResponse({ status: 200, contentType: "application/pdf" }).code,
    "content-type-not-allowed",
  );
  assert.equal(
    checkResponse({ status: 200, contentType: "text/html", contentLength: 99_000_000 }).code,
    "response-too-large",
  );
});

test("reads robots.txt groups and lets the longest rule win", () => {
  const groups = parseRobots(`
# contoh
User-agent: *
Disallow: /admin
Allow: /admin/publik

User-agent: AksaraNetra-Accessibility
Disallow:
`);

  assert.equal(groups.length, 2);

  assert.equal(isAllowed(groups, "/admin/rahasia", "SomeOtherBot").allowed, false);
  // The longer Allow rule beats the shorter Disallow rule.
  assert.equal(isAllowed(groups, "/admin/publik/a", "SomeOtherBot").allowed, true);
  assert.equal(isAllowed(groups, "/berita", "SomeOtherBot").allowed, true);

  // An empty Disallow forbids nothing, and our own name is more specific
  // than the star group.
  assert.equal(isAllowed(groups, "/admin/rahasia", "AksaraNetra-Accessibility").allowed, true);
});

test("handles star and end-of-path markers in robots rules", () => {
  const groups = parseRobots("User-agent: *\nDisallow: /*.pdf$\nDisallow: /cari/*/cetak");

  assert.equal(isAllowed(groups, "/dokumen/surat.pdf", "bot").allowed, false);
  assert.equal(isAllowed(groups, "/dokumen/surat.pdf.html", "bot").allowed, true);
  assert.equal(isAllowed(groups, "/cari/berita/cetak", "bot").allowed, false);
  assert.equal(isAllowed(groups, "/cari/berita", "bot").allowed, true);
});

test("stops when robots.txt cannot be read, but continues when it is absent", () => {
  // Missing file is the normal case on many sites and means no restriction.
  assert.equal(checkRobots({ status: 404, url: "https://a.go.id/x" }).ok, true);

  // A server error is not permission. We choose to stop.
  const broken = checkRobots({ status: 503, url: "https://a.go.id/x" });
  assert.equal(broken.ok, false);
  assert.equal(broken.code, "robots-unavailable");

  const blocked = checkRobots({
    status: 200,
    text: "User-agent: *\nDisallow: /rahasia",
    url: "https://a.go.id/rahasia/berkas",
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "robots-disallowed");
});

test("keeps unstable sites out of the demo catalog", () => {
  // Our own research showed these two swing wildly from one day to the next.
  // Showing them to a judge would invite a result we cannot reproduce.
  assert.equal(isExcluded("jogjaprov.go.id"), true);
  assert.equal(isExcluded("www.babelprov.go.id"), true);
  assert.equal(isExcluded("sulselprov.go.id"), false);

  for (const entry of CATALOG) {
    assert.equal(isExcluded(entry.host), false, `${entry.host} is both listed and excluded`);
  }
});

test("only shows sites the engine has actually been run against", () => {
  const demo = listDemoSites();
  assert.equal(demo.length, 2);

  for (const entry of demo) {
    assert.ok(entry.baselineRuns >= 2, `${entry.id} needs a repeated baseline`);
    assert.ok(entry.lastVerifiedOn, `${entry.id} needs a verification date`);
    assert.equal(checkUrl(entry.url).ok, true, `${entry.id} has an unusable url`);
  }

  // Candidates carry no claim at all until someone runs them.
  for (const entry of CATALOG.filter((item) => item.status === "candidate")) {
    assert.equal(entry.baselineRuns, 0);
    assert.equal(entry.lastVerifiedOn, null);
  }
});
