'use client';
import { Check } from 'lucide-react';
import type { AnswerValue, Question } from '@/lib/types';
import { qPoints, qType, TYPE_LABEL } from '@/lib/scoring';
import { cn } from '@/lib/utils';

const LETTERS = 'ABCDE';

/**
 * Tampilan & input jawaban satu soal sesuai tipenya (PG, PG kompleks, benar/salah, esai).
 * showKey: tandai kunci jawaban (untuk guru/staf).
 */
export function QuestionInput({ q, value, onChange, disabled, showKey, compact }: { q: Question; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void; disabled?: boolean; showKey?: boolean; compact?: boolean }) {
  const t = qType(q);
  const opt = (selected: boolean, isKey: boolean) =>
    cn('flex w-full items-center gap-3 rounded-lg border-2 text-left transition', compact ? 'p-2 text-sm' : 'p-3', selected ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300', showKey && isKey && 'border-emerald-400 bg-emerald-50', disabled && 'cursor-default');

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{TYPE_LABEL[t]}</span>
        <span>{qPoints(q)} poin</span>
        {t === 'pgk' && <span className="font-medium text-amber-700">Pilih semua jawaban yang benar</span>}
      </div>
      {t === 'esai' ? (
        <>
          <textarea
            className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50"
            rows={compact ? 4 : 8} disabled={disabled} value={typeof value === 'string' ? value : ''} placeholder="Tulis jawaban Anda di sini…"
            onChange={(e) => onChange(e.target.value)}
          />
          {showKey && q.key && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800"><b>Kunci/rubrik:</b> {q.key}</p>}
        </>
      ) : t === 'bs' ? (
        <div className="grid grid-cols-2 gap-3">
          {['Benar', 'Salah'].map((label, k) => (
            <button key={label} type="button" disabled={disabled} onClick={() => onChange(k)} className={cn(opt(value === k, q.answer === k), 'justify-center font-semibold')}>{label}</button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {q.options.map((o, k) => {
            const selected = t === 'pgk' ? Array.isArray(value) && value.includes(k) : value === k;
            const isKey = t === 'pgk' ? (q.answers || []).includes(k) : q.answer === k;
            return (
              <button key={k} type="button" disabled={disabled} className={opt(selected, isKey)}
                onClick={() => {
                  if (t !== 'pgk') return onChange(k);
                  const cur = Array.isArray(value) ? value : [];
                  onChange(cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k].sort());
                }}>
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center text-sm font-bold', t === 'pgk' ? 'rounded-md' : 'rounded-full', selected ? 'bg-brand-600 text-white' : 'bg-slate-100')}>
                  {t === 'pgk' && selected ? <Check className="h-4 w-4" /> : LETTERS[k]}
                </span>
                {o}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
