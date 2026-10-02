/**
 * Helper tes E2E iSchool.
 *
 * Variabel lingkungan:
 *   BASE    URL frontend (default http://localhost:4317) — jalankan build statis: `python3 -m http.server 4317 -d frontend/out`
 *   API     URL backend untuk mode LIVE (kosong = mode demo, login via tombol demo)
 *   CHROME  path Chrome/Chromium (default Google Chrome di macOS)
 *   OUT     folder screenshot (default e2e/shots)
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

export const BASE = process.env.BASE || 'http://localhost:4317';
export const API = process.env.API || '';
export const OUT = process.env.OUT || path.join(path.dirname(new URL(import.meta.url).pathname), 'shots');
fs.mkdirSync(OUT, { recursive: true });

const USERNAME = { Administrator: 'admin', 'Kepala Sekolah': 'kepsek', 'Bagian Keuangan': 'keuangan', 'Bagian Kesiswaan': 'kesiswaan', Pustakawan: 'pustakawan', Guru: 'guru', Siswa: 'siswa', 'Orang Tua': 'ortu' };
export const ROLE_LABEL = { admin: 'Administrator', kepsek: 'Kepala Sekolah', keuangan: 'Bagian Keuangan', kesiswaan: 'Bagian Kesiswaan', pustakawan: 'Pustakawan', guru: 'Guru', siswa: 'Siswa', ortu: 'Orang Tua' };

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function start({ args = [] } = {}) {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  page.on('dialog', (d) => d.accept());
  const errors = [];
  page.on('pageerror', (e) => errors.push(`[pageerror] ${page.url()} ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|401/.test(m.text())) errors.push(`[console] ${page.url()} ${m.text()}`); });
  let passed = 0, failed = 0;
  const t = {
    browser, page, errors,
    check(name, ok) { console.log(ok ? 'PASS' : 'FAIL', name); ok ? passed++ : failed++; },
    text: () => page.evaluate(() => document.body.innerText),
    main: () => page.evaluate(() => document.querySelector('main')?.innerText || ''),
    async go(p) { await page.goto(BASE + p, { waitUntil: 'networkidle0' }); await sleep(900); },
    /** Klik tombol pertama (yang aktif) yang teksnya diawali `label`. */
    async click(label, scope = 'button') {
      await page.evaluate((l, sel) => {
        const b = [...document.querySelectorAll(sel)].find((x) => x.innerText.trim().startsWith(l) && !x.disabled);
        if (!b) throw new Error('tombol tidak ditemukan: ' + l);
        b.click();
      }, label, scope);
      await sleep(400);
    },
    /** Set nilai input/select/textarea ala React. */
    async set(selector, value, idx = 0) {
      await page.evaluate((selector, value, idx) => {
        const el = document.querySelectorAll(selector)[idx];
        if (!el) throw new Error('elemen tidak ditemukan: ' + selector);
        const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
        el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      }, selector, value, idx);
      await sleep(150);
    },
    async login(role) {
      const label = ROLE_LABEL[role] || role;
      if (API) {
        const r = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USERNAME[label] || role, password: process.env.PASSWORD || 'demo123' }) });
        const j = await r.json();
        await page.goto(BASE + '/login/', { waitUntil: 'networkidle0' });
        await page.evaluate((tok, u) => { localStorage.setItem('ischool-token', tok); localStorage.setItem('ischool-user', JSON.stringify(u)); }, j.access_token, j.user);
        await page.goto(BASE + '/dashboard/', { waitUntil: 'networkidle0' });
      } else {
        await page.evaluate(() => { localStorage.removeItem('ischool-user'); });
        await page.goto(BASE + '/login/', { waitUntil: 'networkidle0' });
        await sleep(700);
        await t.click(label);
        await page.waitForFunction(() => location.pathname.includes('/dashboard'), { timeout: 10000 });
      }
      await sleep(1000);
    },
    async resetDemo() {
      await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
      if (!API) await page.evaluate(() => localStorage.clear());
    },
    shot: (name, fullPage = false) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage }),
    async finish() {
      console.log(`\n${passed} lulus, ${failed} gagal, ${errors.length} error halaman`);
      errors.slice(0, 5).forEach((e) => console.log(e));
      await browser.close();
      process.exit(failed || errors.length ? 1 : 0);
    },
  };
  return t;
}
