import type { DB, Resource } from '../types';
import { buildSeed, SEED_VERSION } from './seed';

const KEY = `ischool-demo-db-v${SEED_VERSION}`;

/** Koleksi yang ditambahkan setelah rilis awal; diisi otomatis pada data demo lama. */
const ADDED_COLLECTIONS: Resource[] = ['lessons', 'lesson_progress', 'virtual_classes', 'discussions', 'enrollments', 'expenses', 'leave_requests', 'teaching_journals', 'books', 'book_loans', 'book_reservations', 'exam_periods', 'exam_dispensations', 'exam_checkins'];

let db: DB | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

export function getDB(): DB {
  if (db) return db;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        db = JSON.parse(raw) as DB;
        // Migrasi: tambahkan koleksi baru (mis. e-learning) tanpa menghapus data yang sudah diubah pengguna
        const cur = db as unknown as Record<string, unknown>;
        if (ADDED_COLLECTIONS.some((k) => !(k in cur))) {
          const fresh = buildSeed() as unknown as Record<string, unknown>;
          ADDED_COLLECTIONS.forEach((k) => { if (!(k in cur)) cur[k] = fresh[k]; });
          persist();
        }
        return db;
      }
    } catch {
      /* corrupted or blocked storage -> reseed */
    }
  }
  db = buildSeed();
  persist();
  return db;
}

function persist() {
  if (typeof window === 'undefined') return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      // storage penuh / diblokir: data tetap tersedia di memori selama sesi
    }
  }, 150);
}

export function commit() {
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetDB() {
  db = buildSeed();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('ischool-demo-db'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  commit();
}

export function nextId(res: Resource): number {
  const rows = getDB()[res] as { id: number }[];
  return rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
}

export function insert<R extends Resource>(res: R, data: Omit<DB[R][number], 'id'>): DB[R][number] {
  const row = { ...data, id: nextId(res) } as DB[R][number];
  (getDB()[res] as unknown[]).push(row);
  return row;
}

export function patch<R extends Resource>(res: R, id: number, changes: Partial<DB[R][number]>) {
  const rows = getDB()[res] as { id: number }[];
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) throw new Error('Data tidak ditemukan');
  rows[i] = { ...rows[i], ...changes };
  return rows[i] as DB[R][number];
}

export function removeRow(res: Resource, id: number) {
  const d = getDB() as unknown as Record<string, { id: number }[]>;
  d[res] = d[res].filter((r) => r.id !== id);
}
