'use client';
/**
 * API client dengan dua mode:
 *  - DEMO  : NEXT_PUBLIC_API_URL kosong -> data disimpan di localStorage browser (untuk GitHub Pages)
 *  - LIVE  : NEXT_PUBLIC_API_URL diisi  -> memanggil backend FastAPI
 * Kedua mode memakai kontrak yang sama:
 *  GET/POST /api/{resource}, GET/PATCH/DELETE /api/{resource}/{id}, POST /api/actions/{name}, POST /api/auth/login
 */
import { useCallback, useEffect, useState } from 'react';
import type { DB, Resource, User } from './types';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
export const IS_DEMO = !API_URL;

const TOKEN_KEY = 'ischool-token';
const USER_KEY = 'ischool-user';

type Row<R extends Resource> = DB[R][number];
type Filter = Record<string, string | number | boolean | null | undefined>;

// ------------------------------------------------------------------ session
export function getSession(): { token: string | null; user: User | null } {
  if (typeof window === 'undefined') return { token: null, user: null };
  try {
    const u = localStorage.getItem(USER_KEY);
    return { token: localStorage.getItem(TOKEN_KEY), user: u ? (JSON.parse(u) as User) : null };
  } catch {
    return { token: null, user: null };
  }
}

function setSession(token: string | null, user: User | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ change bus
const bus = new Set<(res?: string) => void>();
/** Aksi yang hanya membaca data: tidak memicu muat-ulang koleksi (mencegah render berulang). */
const READ_ONLY_ACTIONS = new Set(['public.portal', 'ppdb.status', 'examcard.get', 'exams.saveAnswers']);
function emit(res?: string) {
  bus.forEach((fn) => fn(res));
}

// ------------------------------------------------------------------ http
async function http<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { token } = getSession();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && path !== '/api/auth/login') {
    setSession(null, null);
    if (typeof window !== 'undefined') window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/login/`;
  }
  if (!res.ok) {
    let msg = `Terjadi kesalahan (${res.status})`;
    try {
      const j = await res.json();
      msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const qs = (f?: Filter) => {
  if (!f) return '';
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && p.append(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : '';
};

async function demo() {
  const [store, acts] = await Promise.all([import('./demo/store'), import('./demo/actions')]);
  return { store, acts };
}

const matches = (row: Record<string, unknown>, f?: Filter) =>
  !f || Object.entries(f).every(([k, v]) => v === undefined || v === null || v === '' || String(row[k]) === String(v));

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// ------------------------------------------------------------------ public api
export const api = {
  async login(username: string, password: string): Promise<User> {
    if (IS_DEMO) {
      const { store } = await demo();
      const u = store.getDB().users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase() && x.password === password && x.is_active);
      if (!u) throw new Error('Username atau password salah');
      const { password: _pw, ...safe } = u;
      void _pw;
      setSession('demo', safe as User);
      return safe as User;
    }
    const r = await http<{ access_token: string; user: User }>('POST', '/api/auth/login', { username, password });
    setSession(r.access_token, r.user);
    return r.user;
  },

  logout() {
    setSession(null, null);
    cache.clear();
  },

  async list<R extends Resource>(res: R, filter?: Filter): Promise<Row<R>[]> {
    if (IS_DEMO) {
      const { store } = await demo();
      const rows = clone((store.getDB()[res] as Row<R>[]).filter((r) => matches(r as unknown as Record<string, unknown>, filter)));
      if (res === 'users') rows.forEach((r) => delete (r as { password?: string }).password);
      return rows;
    }
    return http<Row<R>[]>('GET', `/api/${res}${qs(filter)}`);
  },

  async create<R extends Resource>(res: R, data: Partial<Row<R>>): Promise<Row<R>> {
    let row: Row<R>;
    if (IS_DEMO) {
      const { store } = await demo();
      row = store.insert(res, data as Omit<Row<R>, 'id'>);
      store.commit();
    } else row = await http<Row<R>>('POST', `/api/${res}`, data);
    emit(res);
    return row;
  },

  async update<R extends Resource>(res: R, id: number, data: Partial<Row<R>>): Promise<Row<R>> {
    let row: Row<R>;
    if (IS_DEMO) {
      const { store } = await demo();
      row = store.patch(res, id, data);
      store.commit();
    } else row = await http<Row<R>>('PATCH', `/api/${res}/${id}`, data);
    emit(res);
    return row;
  },

  async remove(res: Resource, id: number): Promise<void> {
    if (IS_DEMO) {
      const { store } = await demo();
      store.removeRow(res, id);
      store.commit();
    } else await http('DELETE', `/api/${res}/${id}`);
    emit(res);
  },

  async action<T = any>(name: string, payload: unknown = {}): Promise<T> {
    let out: T;
    if (IS_DEMO) {
      const { acts } = await demo();
      const fn = acts.actions[name];
      if (!fn) throw new Error(`Aksi ${name} tidak dikenal`);
      out = clone(fn(payload, getSession().user) as T);
    } else out = await http<T>('POST', `/api/actions/${name}`, payload);
    if (!READ_ONLY_ACTIONS.has(name)) emit();
    return out;
  },
};

// ------------------------------------------------------------------ hooks
/** Memuat beberapa koleksi sekaligus dan otomatis refresh ketika ada perubahan data. */
const cache = new Map<string, unknown>();
function fromCache<K extends Resource>(keys: K[]): Pick<DB, K> | null {
  if (!keys.every((k) => cache.has(k))) return null;
  const out = {} as Pick<DB, K>;
  keys.forEach((k) => ((out as Record<string, unknown>)[k] = cache.get(k)));
  return out;
}

export function useData<K extends Resource>(keys: K[]) {
  const [data, setData] = useState<Pick<DB, K> | null>(() => fromCache(keys));
  const [error, setError] = useState<string | null>(null);
  const keyStr = keys.join(',');

  const load = useCallback(async () => {
    try {
      const ks = keyStr.split(',') as K[];
      const lists = await Promise.all(ks.map((k) => api.list(k)));
      const out = {} as Pick<DB, K>;
      ks.forEach((k, i) => {
        (out as Record<string, unknown>)[k] = lists[i];
        cache.set(k, lists[i]);
      });
      setData(out);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [keyStr]);

  useEffect(() => {
    load();
    const ks = new Set(keyStr.split(','));
    const fn = (res?: string) => {
      if (!res || ks.has(res)) load();
    };
    bus.add(fn);
    return () => {
      bus.delete(fn);
    };
  }, [load, keyStr]);

  return { data, error, reload: load };
}

export function useAction<T = any>(name: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.action<T>(name).then(setData).catch((e) => setError(e.message));
  }, [name]);
  return { data, error };
}
