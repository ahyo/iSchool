'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Inbox, Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ---------------- Button ---------------- */
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
export function Button({ variant = 'primary', size = 'md', loading, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  };
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        v[variant],
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ---------------- Card ---------------- */
export function Card({ title, actions, children, className, bodyClass }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      )}
      <div className={cn('p-4', bodyClass)}>{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  violet: 'bg-violet-50 text-violet-600',
  slate: 'bg-slate-100 text-slate-600',
  cyan: 'bg-cyan-50 text-cyan-600',
};
export type Tone = keyof typeof TONES;

export function StatCard({ label, value, icon: Icon, tone = 'blue', hint }: { label: string; value: React.ReactNode; icon?: React.ElementType; tone?: Tone; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold text-slate-900">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn('rounded-lg p-2.5', TONES[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', TONES[tone], className)}>{children}</span>;
}

const STATUS_TONE: Record<string, Tone> = {
  lunas: 'green', sebagian: 'amber', belum: 'red',
  aktif: 'green', lulus: 'blue', pindah: 'amber', keluar: 'red',
  baru: 'blue', verifikasi: 'amber', diterima: 'green', ditolak: 'red', daftar_ulang: 'violet',
  H: 'green', S: 'amber', I: 'blue', A: 'red', DL: 'violet',
  naik: 'green', tinggal: 'red',
  pelanggaran: 'red', prestasi: 'green', konseling: 'blue',
};
const STATUS_LABEL: Record<string, string> = {
  lunas: 'Lunas', sebagian: 'Sebagian', belum: 'Belum Bayar', aktif: 'Aktif', lulus: 'Lulus', pindah: 'Pindah', keluar: 'Keluar',
  baru: 'Baru', verifikasi: 'Verifikasi', diterima: 'Diterima', ditolak: 'Ditolak', daftar_ulang: 'Sudah Daftar Ulang',
  H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpa', DL: 'Dinas Luar', naik: 'Naik Kelas', tinggal: 'Tinggal Kelas',
  pelanggaran: 'Pelanggaran', prestasi: 'Prestasi', konseling: 'Konseling',
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] || 'slate'}>{STATUS_LABEL[status] || status}</Badge>;
}

/* ---------------- Form controls ---------------- */
export function Field({ label, children, hint, className, required }: { label: string; children: React.ReactNode; hint?: string; className?: string; required?: boolean }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-100';
/** Lebar default penuh kecuali className menentukan lebar sendiri (w-*). */
const widthCls = (className?: string) => (/(^|\s)w-/.test(className || '') ? '' : 'w-full');
export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={cn(inputCls, widthCls(props.className), props.className)} />;
export const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...props} className={cn(inputCls, widthCls(props.className), props.className)} />;
export function Select({ options, placeholder, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string | number; label: string }[]; placeholder?: string }) {
  return (
    <select {...props} className={cn(inputCls, widthCls(className), className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Cari...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(inputCls, 'w-56 pl-8')} />
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-10 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={cn('w-full rounded-xl bg-white shadow-xl', w)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------- Table ---------------- */
export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  sortValue?: (row: T) => string | number;
}

export function DataTable<T extends { id: number }>({ rows, columns, pageSize = 15, empty = 'Belum ada data', onRowClick }: { rows: T[]; columns: Column<T>[]; pageSize?: number; empty?: string; onRowClick?: (row: T) => void }) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const val = col.sortValue || ((r: T) => String((r as Record<string, unknown>)[col.key] ?? ''));
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
    });
  }, [rows, sort, columns]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const p = Math.min(page, pages - 1);
  const view = sorted.slice(p * pageSize, (p + 1) * pageSize);
  useEffect(() => setPage(0), [rows.length]);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn('cursor-pointer select-none whitespace-nowrap px-3 py-2.5 font-semibold hover:text-slate-700', c.className)}
                  onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 }))}
                >
                  {c.header}
                  {sort?.key === c.key && (sort.dir === 1 ? ' ▲' : ' ▼')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn('border-b border-slate-100 last:border-0 hover:bg-slate-50', onRowClick && 'cursor-pointer')}>
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-3 py-2.5 align-middle text-slate-700', c.className)}>
                    {c.render ? c.render(r, p * pageSize + i) : String((r as Record<string, unknown>)[c.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty text={empty} />}
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <span>
            {p * pageSize + 1}–{Math.min((p + 1) * pageSize, sorted.length)} dari {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" disabled={p === 0} onClick={() => setPage(p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2">
              {p + 1} / {pages}
            </span>
            <Button variant="secondary" size="sm" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Empty({ text = 'Belum ada data' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
      <Inbox className="mb-2 h-8 w-8" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition', value === t.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
  const c = colors[name.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % colors.length];
  const ini = name.replace(/^(Dr\.|Dra\.|Drs\.|Ir\.|Hj?\.)\s*/g, '').split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white', c, className)}>{ini}</div>;
}

/* ---------------- Toast ---------------- */
type ToastMsg = { id: number; text: string; type: 'success' | 'error' };
let pushToast: (t: Omit<ToastMsg, 'id'>) => void = () => {};
export const toast = {
  success: (text: string) => pushToast({ text, type: 'success' }),
  error: (text: string) => pushToast({ text, type: 'error' }),
};
export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    pushToast = (t) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { ...t, id }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3500);
    };
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className={cn('max-w-sm rounded-lg px-4 py-3 text-sm text-white shadow-lg', t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600')}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** Helper: jalankan aksi async dengan toast sukses/gagal. */
export async function run<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined> {
  try {
    const r = await fn();
    if (success) toast.success(success);
    return r;
  } catch (e) {
    toast.error((e as Error).message);
    return undefined;
  }
}

export function ProgressBar({ value, tone = 'blue' }: { value: number; tone?: 'blue' | 'green' | 'amber' | 'red' }) {
  const c = { blue: 'bg-brand-600', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cn('h-full rounded-full', c)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
