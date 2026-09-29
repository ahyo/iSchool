// Smoke test: login tiap peran lalu buka setiap menu di sidebar; gagal bila ada error halaman / akses ditolak.
import { start, sleep } from './lib.mjs';

const roles = (process.env.ROLES || 'admin,kepsek,keuangan,kesiswaan,pustakawan,guru,siswa,ortu').split(',');
const t = await start();
await t.resetDemo();
for (const role of roles) {
  await t.login(role);
  const links = await t.page.$$eval('aside nav a', (as) => as.map((a) => a.href));
  let ok = 0;
  for (const href of links) {
    await t.page.goto(href, { waitUntil: 'networkidle0' });
    await sleep(500);
    const state = await t.page.evaluate(() => (document.body.innerText.includes('Akses ditolak') ? 'denied' : document.querySelector('main') ? 'ok' : 'blank'));
    if (state !== 'ok') t.check(`${role} ${href.replace(/^https?:\/\/[^/]+/, '')} (${state})`, false);
    else ok++;
  }
  t.check(`${role}: ${ok}/${links.length} halaman terbuka`, ok === links.length);
}
await t.finish();
