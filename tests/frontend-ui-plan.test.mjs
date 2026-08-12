import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) =>
  fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const globals = read("src/app/globals.css");
const header = read("src/components/Header.module.css");
const home = read("src/app/page.tsx");
const history = read("src/app/katalog/page.tsx");
const result = read("src/app/result/page.tsx");
const resultCss = read("src/app/result/page.module.css");
const about = read("src/app/about/page.tsx");
const aboutCss = read("src/app/about/page.module.css");
const caraCss = read("src/app/cara-kerja/page.module.css");

test("visual foundation has grain without radial gradients or yellow", () => {
  const allCss = [globals, header, resultCss, aboutCss, caraCss].join("\n");
  assert.match(globals, /feTurbulence/);
  assert.match(globals, /pointer-events:\s*none/);
  assert.doesNotMatch(allCss, /radial-gradient/i);
  assert.doesNotMatch(allCss, /#ffb703|#fff8e6|#8a6503|#fdf0d5/i);
});

test("navbar remains sticky and exposes the active page", () => {
  assert.match(header, /position:\s*sticky/);
  assert.match(header, /top:\s*0/);
  assert.doesNotMatch(header, /position:\s*static/);
  assert.match(read("src/components/Header.tsx"), /aria-current/);
});

test("landing uses the approved copy without decorative kicker", () => {
  assert.match(home, /Temukan hambatan aksesibilitas di halaman web/);
  assert.match(home, /Periksa halaman publik/);
  assert.match(home, /Mulai pemeriksaan/);
  assert.doesNotMatch(home, /Audit aksesibilitas terukur/);
});

test("completed history opens result directly without exposing token", () => {
  assert.match(history, /completed \? "&open=1"/);
  assert.match(result, /directOpen/);
  assert.match(result, /loadResult\(jobParam, saved\)/);
  assert.doesNotMatch(history, /accessToken/);
});

test("loading uses real progress, stable stage area, and reduced motion", () => {
  assert.match(result, /<progress/);
  assert.match(resultCss, /min-block-size/);
  assert.match(resultCss, /softPulse/);
  assert.match(resultCss, /prefers-reduced-motion/);
  assert.match(result, /aria-live="polite"/);
});

test("result normalizes counts and provides a guarded conclusion", () => {
  assert.match(result, /function count\(/);
  assert.match(result, /Sebagian besar hambatan berhasil diperbaiki/);
  assert.match(result, /Masih ada hambatan yang perlu ditinjau/);
  assert.match(result, /tidak berarti halaman sudah sepenuhnya aksesibel/i);
  assert.match(result, /Lihat detail pemeriksaan/);
  assert.match(result, /Tidak ada masalah baru setelah perbaikan/);
});

test("about cards use semantic lists and outlined white surfaces", () => {
  assert.match(about, /<ul/);
  assert.match(about, /<li/);
  assert.match(about, /Apa yang dilakukan AksaraNetra/);
  assert.match(aboutCss, /background:\s*var\(--color-surface\)/);
  assert.match(aboutCss, /border:\s*1px solid var\(--color-border-strong\)/);
});
