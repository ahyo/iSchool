/* Ekspor data contoh (sama dengan mode demo) untuk seed database backend.
 * Jalankan: npm run export-seed  ->  ../backend/app/seed_data.json */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSeed } from '../src/lib/demo/seed';

const out = resolve(__dirname, '../../backend/app/seed_data.json');
writeFileSync(out, JSON.stringify(buildSeed()));
console.log('Seed diekspor ke', out);
