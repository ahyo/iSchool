'use client';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input } from './ui';
import type { Question } from '@/lib/types';

export const emptyQuestion = (): Question => ({ q: '', options: ['', '', '', ''], answer: 0 });

export function validateQuestions(qs: Question[]) {
  if (!qs.length) throw new Error('Tambahkan minimal satu soal');
  if (qs.some((q) => !q.q.trim() || q.options.some((o) => !o.trim()))) throw new Error('Lengkapi semua soal dan pilihan jawaban');
}

/** Editor soal pilihan ganda (dipakai ujian CBT dan kuis e-learning). */
export function QuestionEditor({ questions, onChange }: { questions: Question[]; onChange: (qs: Question[]) => void }) {
  const setQ = (i: number, q: Partial<Question>) => onChange(questions.map((x, j) => (j === i ? { ...x, ...q } : x)));
  return (
    <div className="space-y-4">
      <p className="font-semibold">Soal Pilihan Ganda ({questions.length})</p>
      {questions.map((q, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-500">{i + 1}.</span>
            <Input value={q.q} placeholder="Pertanyaan" onChange={(x) => setQ(i, { q: x.target.value })} />
            <Button size="sm" variant="ghost" onClick={() => onChange(questions.filter((_, j) => j !== i))} title="Hapus soal"><Trash2 className="h-4 w-4 text-red-500" /></Button>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {q.options.map((o, k) => (
              <label key={k} className="flex items-center gap-2">
                <input type="radio" name={`ans-${i}`} checked={q.answer === k} onChange={() => setQ(i, { answer: k })} title="Kunci jawaban" />
                <span className="text-sm font-semibold">{String.fromCharCode(65 + k)}</span>
                <Input value={o} onChange={(x) => setQ(i, { options: q.options.map((y, m) => (m === k ? x.target.value : y)) })} />
              </label>
            ))}
          </div>
        </div>
      ))}
      <Button variant="secondary" onClick={() => onChange([...questions, emptyQuestion()])}><Plus className="h-4 w-4" /> Tambah Soal</Button>
      <p className="text-xs text-slate-500">Pilih tombol radio untuk menandai kunci jawaban. Nilai dihitung otomatis.</p>
    </div>
  );
}
