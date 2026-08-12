import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) =>
  fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const resultPage = read("src/app/result/page.tsx");
const apiClient = read("src/lib/audit-api.ts");
const homePage = read("src/app/page.tsx");
const packageJson = JSON.parse(read("package.json"));

test("legacy fast engine and endpoint are gone", () => {
  assert.equal(
    fs.existsSync(new URL("../src/app/api/process", import.meta.url)),
    false,
  );
  assert.equal(fs.existsSync(new URL("../lib", import.meta.url)), false);
  assert.equal(packageJson.dependencies.cheerio, undefined);
  assert.equal(packageJson.dependencies["sanitize-html"], undefined);
  assert.doesNotMatch(homePage, /mode cepat|api\/process/i);
});

test("frontend uses the four secured job endpoints", () => {
  assert.match(apiClient, /['"]\/audits['"]/);
  assert.match(apiClient, /\/audits\/cache\?url=/);
  assert.match(apiClient, /getAuditResult/);
  assert.match(apiClient, /method: ['"]DELETE['"]/);
  assert.match(apiClient, /authorization: `Bearer/);
});

test("refresh resume keeps the secret out of the URL", () => {
  assert.match(resultPage, /saveJobToken/);
  assert.match(resultPage, /readJobToken/);
  assert.match(resultPage, /router\.replace\(`\/result\?job=/);
  assert.doesNotMatch(resultPage, /result\?job=.*accessToken/);
});

test("progress is polled, cancellable, and opened by user choice", () => {
  assert.match(resultPage, /setTimeout\(poll, 1500\)/);
  assert.match(resultPage, /Batalkan pemeriksaan/);
  assert.match(resultPage, /Buka hasil/);
  assert.match(resultPage, /aria-live="polite"/);
  assert.match(resultPage, /Gunakan hasil tersimpan/);
  assert.match(resultPage, /Periksa ulang/);
});

test("source HTML is never injected into the frontend", () => {
  assert.doesNotMatch(resultPage, /dangerouslySetInnerHTML/);
  assert.match(resultPage, /Buka reader/);
  assert.match(resultPage, /Unduh laporan PDF/);
});
