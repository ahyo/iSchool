// Tipe soal (PG, PG kompleks, benar/salah, esai), unggah soal dari Excel, pengerjaan CBT, dan koreksi esai.
import path from 'node:path';
import { start, sleep } from './lib.mjs';

const FIXTURE = path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures', 'soal-campuran.xlsx');
const NAME = 'UH Unggah Soal Campuran';
const t = await start();
const { page } = t;
await t.resetDemo();

// ---- 1. Guru membuat ujian dari file Excel
await t.login('guru');
await t.go('/ujian/');
await t.click('Buat Ujian');
await t.set('.fixed.inset-0 input', NAME, 0);
const cls = await page.evaluate(() => [...document.querySelectorAll('.fixed.inset-0 select')[1].options].find((o) => o.text === 'XI MIPA').value);
await t.set('.fixed.inset-0 select', cls, 1);
await t.set('.fixed.inset-0 input[type=time]', '00:00', 0);
await t.set('.fixed.inset-0 input[type=time]', '23:59', 1);
await t.click('Unggah Soal');
const input = (await page.$$('.fixed.inset-0 input[type=file]')).pop();
await input.uploadFile(FIXTURE);
await sleep(1200);
let m = await page.evaluate(() => [...document.querySelectorAll('.fixed.inset-0')].pop().innerText);
t.check('pratinjau unggah: 4 soal valid, 1 baris error', m.includes('4 soal valid') && m.includes('1 baris error') && m.includes('Kunci "" tidak sesuai opsi') && m.includes('Soal rusak tanpa kunci'));
await t.shot('soal-unggah-pratinjau');
await page.evaluate(() => { const box = [...document.querySelectorAll('.fixed.inset-0')].pop(); [...box.querySelectorAll('label')].find((l) => l.innerText.includes('Ganti semua soal')).click(); });
await sleep(200);
await t.click('Ganti dengan 4 Soal');
m = await page.evaluate(() => document.querySelector('.fixed.inset-0').innerText);
t.check('editor berisi 4 soal hasil unggah (total bobot 15)', m.includes('Soal (4)') && m.includes('total bobot 15'));
const types = await page.evaluate(() => [...document.querySelectorAll('.fixed.inset-0 .rounded-lg.border select')].map((s) => s.value));
t.check(`tipe soal terbaca: ${types.join(', ')}`, types.join(',') === 'pg,pgk,bs,esai');
await t.shot('soal-editor', true);
await t.click('Simpan Ujian');
t.check('ujian tersimpan', (await t.text()).includes('Ujian dibuat'));

// ---- 2. Siswa mengerjakan keempat tipe soal
await t.login('siswa');
await t.go('/ujian/');
await page.evaluate((n) => { const card = [...document.querySelectorAll('main .rounded-xl')].find((c) => c.innerText.includes(n) && c.querySelector('button')); [...card.querySelectorAll('button')].find((b) => /Mulai/.test(b.innerText)).click(); }, NAME);
await sleep(1500);
const opt = (i) => page.evaluate((i) => [...document.querySelectorAll('.fixed button')].filter((b) => /^[A-E✓]?\s*/.test(b.innerText) && b.className.includes('border-2'))[i].click(), i);
await opt(1); await sleep(300); await t.click('Berikutnya');                      // PG: B (benar)
m = await t.text();
t.check('soal PGK menampilkan petunjuk "Pilih semua jawaban yang benar"', m.includes('Pilih semua jawaban yang benar'));
await opt(0); await opt(2); await opt(4); await sleep(300);                    // PGK: A, C, E (benar)
const pgkSel = await page.evaluate(() => [...document.querySelectorAll('.fixed button')].filter((b) => b.className.includes('border-2') && b.className.includes('border-brand-500')).length);
t.check('PGK: tiga pilihan terpilih bersamaan', pgkSel === 3);
await t.click('Berikutnya');
await page.evaluate(() => [...document.querySelectorAll('.fixed button')].find((b) => b.innerText.trim() === 'Benar').click()); await sleep(300); // BS: Benar (benar)
await t.click('Berikutnya');
await t.set('.fixed textarea', 'Bhinneka Tunggal Ika berarti berbeda-beda tetapi tetap satu jua.');
await sleep(1300);
t.check('esai tersimpan otomatis', (await t.text()).includes('Jawaban tersimpan'));
await t.shot('soal-cbt-esai');
await t.click('Kirim Jawaban');
await sleep(900);
m = await t.text();
t.check('hasil: nilai sementara 33 (5/15 poin objektif) menunggu koreksi esai', m.includes('Nilai sementara') && /\b33\b/.test(m));
await t.click('Tutup');
m = await t.main();
t.check('riwayat: "Menunggu koreksi"', m.includes('Menunggu koreksi'));

// ---- 3. Guru mengoreksi esai
await t.login('guru');
await t.go('/ujian/');
m = await t.main();
t.check('daftar ujian: badge "esai perlu dikoreksi"', m.includes('esai perlu dikoreksi'));
await page.evaluate((n) => { const row = [...document.querySelectorAll('main .divide-y > div')].find((r) => r.innerText.includes(n)); [...row.querySelectorAll('button')].find((b) => b.innerText.includes('Hasil')).click(); }, NAME);
await sleep(600);
await t.click('Koreksi');
const gradingBox = "[...document.querySelectorAll('.fixed.inset-0')].find((b) => b.innerText.includes('Koreksi Esai'))";
m = await page.evaluate(`${gradingBox}.innerText`);
const onTop = await page.evaluate(`(() => { const box = ${gradingBox}; const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return box.contains(el); })()`);
t.check('modal koreksi tampil di atas modal hasil (tidak tertutup)', onTop);
t.check('modal koreksi menampilkan jawaban siswa & rubrik', m.includes('berbeda-beda tetapi tetap satu jua') && m.includes('Kunci/rubrik'));
await page.evaluate(`(() => { const box = ${gradingBox}; const inp = box.querySelector('input[type=number]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '8'); inp.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(200);
await t.shot('soal-koreksi');
await t.click('Simpan Nilai');
t.check('nilai esai disimpan', (await t.text()).includes('Nilai esai disimpan'));

// ---- 4. Siswa melihat nilai akhir
await t.login('siswa');
await t.go('/ujian/');
m = await t.main();
const row = await page.evaluate((n) => [...document.querySelectorAll('main tbody tr')].find((r) => r.innerText.includes(n))?.innerText || '', NAME);
t.check(`nilai akhir 87 ((5+8)/15) setelah dikoreksi: "${row.replace(/\s+/g, ' ')}"`, /87$/.test(row.trim()) && !row.includes('Menunggu'));

// ---- 5. Kuis e-learning tetap berfungsi dengan komponen soal baru
await t.go('/elearning/');
await page.evaluate(() => [...document.querySelectorAll('main button')].find((b) => b.innerText.includes('Matematika') && b.innerText.includes('pelajaran')).click());
await sleep(800);
await page.evaluate(() => [...document.querySelectorAll('main button')].find((b) => b.innerText.startsWith('Kuis Pemahaman Bab 1')).click());
await sleep(500);
const nq = await page.evaluate(() => document.querySelectorAll('main .rounded-lg.border.p-4').length);
for (let i = 0; i < nq; i++) {
  await page.evaluate((i) => document.querySelectorAll('main .rounded-lg.border.p-4')[i].querySelector('button.border-2').click(), i);
  await sleep(200);
}
await t.click('Kirim');
await sleep(800);
t.check('kuis e-learning dinilai', /\d+ dari \d+ soal benar/.test(await t.main()));
await t.finish();
