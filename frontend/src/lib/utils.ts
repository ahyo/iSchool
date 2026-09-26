import clsx, { type ClassValue } from 'clsx';

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export const pad = (n: number, len = 2) => String(n).padStart(len, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return toISODate(new Date());
}

export function nowTime(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function isWeekend(date: string): boolean {
  const day = new Date(date + 'T00:00:00').getDay();
  return day === 0 || day === 6;
}

export const rupiah = (n: number | null | undefined) =>
  'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

export const compactRupiah = (n: number) => {
  if (n >= 1e9) return `Rp ${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (n >= 1e6) return `Rp ${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (n >= 1e3) return `Rp ${(n / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return rupiah(n);
};

export function fmtDate(value?: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '-';
  const d = value.length <= 10 ? new Date(value + 'T00:00:00') : new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', opts);
}

export function fmtDateTime(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function periodLabel(period: string) {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return `${MONTHS[m - 1]} ${y}`;
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
}

export function avg(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === 'number' && !isNaN(x));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function round(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined) return null;
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

/** Nilai akhir = 30% tugas + 20% harian + 20% PTS + 30% PAS */
export function computeFinal(g: { assignment: number | null; daily: number | null; midterm: number | null; final_exam: number | null }) {
  const parts: [number | null, number][] = [
    [g.assignment, 0.3],
    [g.daily, 0.2],
    [g.midterm, 0.2],
    [g.final_exam, 0.3],
  ];
  const present = parts.filter(([v]) => typeof v === 'number') as [number, number][];
  if (!present.length) return null;
  const w = present.reduce((a, [, wt]) => a + wt, 0);
  return Math.round((present.reduce((a, [v, wt]) => a + v * wt, 0) / w) * 10) / 10;
}

export function predicate(score: number | null) {
  if (score === null) return '-';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  return 'D';
}

export function gradeLabel(grade: number) {
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return roman[grade] || String(grade);
}

export function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
