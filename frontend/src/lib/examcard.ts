/** Kelayakan kartu ujian. Padanan server: backend/app/examcard.py */
import type { Bill, ExamDispensation, ExamPeriod, FeeType, Student } from './types';
import { periodLabel } from './utils';

export interface Requirement {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  outstanding: number;
}

export interface Eligibility {
  applicable: boolean;
  eligible: boolean;
  requirements: Requirement[];
  dispensation: ExamDispensation | null;
}

type D = { bills: Bill[]; fee_types: FeeType[]; exam_dispensations: ExamDispensation[] };

const remaining = (b: Bill) => b.amount - b.discount - b.paid_amount;

export function examEligibility(d: D, period: ExamPeriod, student: Student): Eligibility {
  const applicable = student.status === 'aktif' && (!period.unit_id || period.unit_id === student.unit_id);
  const requirements: Requirement[] = [];
  const bills = d.bills.filter((b) => b.student_id === student.id);

  if (period.spp_until) {
    const sppTypes = new Set(d.fee_types.filter((f) => f.category === 'bulanan').map((f) => f.id));
    const unpaid = bills.filter((b) => sppTypes.has(b.fee_type_id) && b.period <= period.spp_until && b.status !== 'lunas');
    requirements.push({
      key: 'spp', label: `SPP lunas s.d. ${periodLabel(period.spp_until)}`, ok: unpaid.length === 0,
      detail: unpaid.length ? `Belum lunas: ${unpaid.map((b) => periodLabel(b.period)).join(', ')}` : 'Lunas',
      outstanding: unpaid.reduce((a, b) => a + remaining(b), 0),
    });
  }
  for (const fid of period.required_fee_type_ids) {
    const fee = d.fee_types.find((f) => f.id === fid);
    if (!fee || (fee.unit_id && fee.unit_id !== student.unit_id)) continue;
    const fb = bills.filter((b) => b.fee_type_id === fid);
    const unpaid = fb.filter((b) => b.status !== 'lunas');
    requirements.push({
      key: `fee-${fid}`, label: fee.name, ok: unpaid.length === 0,
      detail: !fb.length ? 'Belum ditagihkan' : unpaid.length ? 'Belum lunas' : 'Lunas',
      outstanding: unpaid.reduce((a, b) => a + remaining(b), 0),
    });
  }
  const dispensation = d.exam_dispensations.find((x) => x.period_id === period.id && x.student_id === student.id) || null;
  return { applicable, eligible: applicable && (!!dispensation || requirements.every((r) => r.ok)), requirements, dispensation };
}

/** Periode ujian aktif yang berlaku untuk tipe & tanggal ujian tertentu. */
export function periodForExam(periods: ExamPeriod[], type: string, date: string, unitId: number) {
  return periods.find((p) => p.is_active && p.type === type && date >= p.start_date && date <= p.end_date && (!p.unit_id || p.unit_id === unitId));
}

export const QR_PREFIX = 'ISCHOOL-KU';
export function parseCardPayload(s: string): { period_id: number; nis: string; token: string } | null {
  const m = s.trim().match(/^ISCHOOL-KU:(\d+):([^:]+):([a-f0-9]+)$/i);
  return m ? { period_id: Number(m[1]), nis: m[2], token: m[3].toLowerCase() } : null;
}

/** Token demo (FNV-1a). Di mode live token dibuat server dengan HMAC-SHA256. */
export function demoToken(periodId: number, studentId: number) {
  let h = 0x811c9dc5;
  for (const ch of `${periodId}:${studentId}:iSchool-demo-kartu-ujian`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
