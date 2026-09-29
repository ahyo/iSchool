'use client';
import { useState } from 'react';
import { Download, FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react';
import { Badge, Button, Input, Modal, Select, Textarea, toast } from './ui';
import type { Question, QuestionType } from '@/lib/types';
import { qPoints, qType, TYPE_LABEL, validateQuestion } from '@/lib/scoring';
import { cn } from '@/lib/utils';

const LETTERS = 'ABCDE';

export const emptyQuestion = (type: QuestionType = 'pg'): Question =>
  type === 'bs' ? { type, q: '', options: ['Benar', 'Salah'], answer: 0, points: 1 }
  : type === 'esai' ? { type, q: '', options: [], answer: -1, key: '', points: 10 }
  : type === 'pgk' ? { type, q: '', options: ['', '', '', ''], answer: -1, answers: [], points: 1 }
  : { type, q: '', options: ['', '', '', ''], answer: 0, points: 1 };

export function validateQuestions(qs: Question[]) {
  if (!qs.length) throw new Error('Tambahkan minimal satu soal');
  const err = qs.map((q, i) => validateQuestion(q, i)).find(Boolean);
  if (err) throw new Error(err);
}

/** Ubah tipe soal dengan mempertahankan teks pertanyaan & opsi bila memungkinkan. */
function convert(q: Question, type: QuestionType): Question {
  const base = emptyQuestion(type);
  const opts = type === 'pg' || type === 'pgk' ? (q.options.length >= 2 && qType(q) !== 'bs' ? q.options : base.options) : base.options;
  return { ...base, q: q.q, options: opts, points: q.points && qType(q) !== 'esai' && type !== 'esai' ? q.points : base.points };
}

/* ------------------------------------------------------------------ Unggah soal */
const TEMPLATE_HEADER = ['No', 'Tipe', 'Pertanyaan', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi E', 'Kunci', 'Bobot'];
const TEMPLATE_EXAMPLES: (string | number)[][] = [
  [1, 'PG', 'Hasil dari 12 × 8 adalah ...', '86', '96', '104', '112', '', 'B', 1],
  [2, 'PGK', 'Manakah yang merupakan bilangan prima?', '2', '9', '11', '15', '17', 'A,C,E', 2],
  [3, 'BS', 'Air mendidih pada suhu 100 °C pada tekanan 1 atm.', '', '', '', '', '', 'Benar', 1],
  [4, 'ESAI', 'Jelaskan proses fotosintesis secara singkat!', '', '', '', '', '', 'Menyebut cahaya matahari, klorofil, CO2 + air → glukosa + O2', 10],
];

async function downloadTemplate() {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([TEMPLATE_HEADER, ...TEMPLATE_EXAMPLES]), 'Soal');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Kolom', 'Keterangan'],
    ['Tipe', 'PG = pilihan ganda · PGK = pilihan ganda kompleks · BS = benar/salah · ESAI = uraian'],
    ['Pertanyaan', 'Teks soal (wajib)'],
    ['Opsi A–E', 'Pilihan jawaban untuk PG/PGK (minimal 2). Kosongkan untuk BS & ESAI'],
    ['Kunci', 'PG: satu huruf (B) · PGK: beberapa huruf dipisah koma (A,C) · BS: Benar/Salah · ESAI: kunci/rubrik untuk korektor'],
    ['Bobot', 'Poin soal (opsional). Bawaan: 1 untuk soal objektif, 10 untuk esai'],
    [],
    ['Catatan', 'Contoh pada sheet "Soal" boleh dihapus/diganti. Isi soal mulai baris ke-2.'],
  ]), 'Petunjuk');
  XLSX.writeFile(wb, 'template-soal-ujian.xlsx');
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const TYPE_ALIAS: Record<string, QuestionType> = { pg: 'pg', pilihanganda: 'pg', pgk: 'pgk', pgkompleks: 'pgk', pilihangandakompleks: 'pgk', kompleks: 'pgk', bs: 'bs', benarsalah: 'bs', bnrslh: 'bs', esai: 'esai', essay: 'esai', uraian: 'esai', isian: 'esai' };

interface ParsedRow { row: number; question: Question | null; errors: string[]; raw: { tipe: string; q: string } }

export function parseQuestionRows(rows: Record<string, unknown>[], allowEssay: boolean): ParsedRow[] {
  return rows.map((raw, i) => {
    const r: Record<string, string> = {};
    Object.entries(raw).forEach(([k, v]) => (r[norm(k)] = String(v ?? '').trim()));
    const errors: string[] = [];
    const type = TYPE_ALIAS[norm(r.tipe || 'pg')];
    if (!type) errors.push(`Tipe "${r.tipe}" tidak dikenal (PG/PGK/BS/ESAI)`);
    if (type === 'esai' && !allowEssay) errors.push('Soal esai tidak didukung di kuis (dinilai otomatis)');
    const text = r.pertanyaan || r.soal || '';
    if (!text) errors.push('Pertanyaan kosong');
    const options = ['a', 'b', 'c', 'd', 'e'].map((l) => r[`opsi${l}`] || '').filter(Boolean);
    const key = r.kunci || '';
    const pts = r.bobot ? Number(r.bobot.replace(',', '.')) : undefined;
    if (pts !== undefined && !(pts > 0)) errors.push('Bobot harus angka > 0');
    let q: Question | null = null;
    if (type && !errors.length) {
      const base = emptyQuestion(type);
      if (type === 'pg' || type === 'pgk') {
        if (options.length < 2) errors.push('Minimal 2 opsi jawaban');
        const idx = key.toUpperCase().split(/[,;\s]+/).filter(Boolean).map((l) => LETTERS.indexOf(l));
        if (!idx.length || idx.some((x) => x < 0 || x >= options.length)) errors.push(`Kunci "${key}" tidak sesuai opsi (gunakan huruf A–${LETTERS[Math.max(0, options.length - 1)]})`);
        else if (type === 'pg' && idx.length !== 1) errors.push('Kunci PG hanya satu huruf (gunakan tipe PGK untuk lebih dari satu)');
        q = { ...base, q: text, options, answer: type === 'pg' ? idx[0] : -1, ...(type === 'pgk' ? { answers: [...new Set(idx)] } : {}), points: pts ?? base.points };
      } else if (type === 'bs') {
        const k = norm(key);
        const ans = ['benar', 'b', 'true', 'betul', 'ya'].includes(k) ? 0 : ['salah', 's', 'false', 'tidak'].includes(k) ? 1 : -1;
        if (ans < 0) errors.push('Kunci benar/salah harus "Benar" atau "Salah"');
        q = { ...base, q: text, answer: ans, points: pts ?? base.points };
      } else {
        q = { ...base, q: text, key, points: pts ?? base.points };
      }
    }
    return { row: i + 2, question: errors.length ? null : q, errors, raw: { tipe: r.tipe || '', q: text } };
  });
}

function QuestionUpload({ allowEssay, onAdd, onClose }: { allowEssay: boolean; onAdd: (qs: Question[], replace: boolean) => void; onClose: () => void }) {
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [name, setName] = useState('');
  const [replace, setReplace] = useState(false);
  const valid = parsed?.filter((p) => p.question).map((p) => p.question!) || [];

  const onFile = async (file: File) => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer());
      const ws = wb.Sheets['Soal'] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false }).filter((r) => Object.values(r).some((v) => String(v).trim()));
      if (!rows.length) throw new Error('File tidak berisi soal');
      if (!Object.keys(rows[0]).some((k) => ['pertanyaan', 'soal'].includes(norm(k)))) throw new Error('Kolom "Pertanyaan" tidak ditemukan. Gunakan template yang disediakan.');
      setName(file.name);
      setParsed(parseQuestionRows(rows, allowEssay));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Modal open onClose={onClose} title="Unggah Soal dari Excel/CSV" size="xl" footer={<>
      <Button variant="secondary" onClick={onClose}>Batal</Button>
      <Button disabled={!valid.length} onClick={() => { onAdd(valid, replace); onClose(); }}><Upload className="h-4 w-4" /> {replace ? 'Ganti dengan' : 'Tambahkan'} {valid.length} Soal</Button>
    </>}>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm">
        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
        <span className="flex-1">Gunakan template: kolom <b>Tipe</b> (PG/PGK/BS/ESAI), <b>Pertanyaan</b>, <b>Opsi A–E</b>, <b>Kunci</b> (B · A,C · Benar/Salah · rubrik esai), <b>Bobot</b>.</span>
        <Button size="sm" variant="secondary" onClick={downloadTemplate}><Download className="h-4 w-4" /> Unduh Template</Button>
      </div>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-6 py-6 text-center hover:border-brand-400 hover:bg-brand-50/40"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
        <Upload className="mb-1 h-6 w-6 text-slate-400" />
        <span className="text-sm font-medium">{name || 'Klik atau seret file soal (.xlsx / .csv)'}</span>
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      </label>
      {parsed && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="green">{valid.length} soal valid</Badge>
            {parsed.length - valid.length > 0 && <Badge tone="red">{parsed.length - valid.length} baris error (dilewati)</Badge>}
            <label className="ml-auto flex items-center gap-2"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Ganti semua soal yang ada</label>
          </div>
          <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="px-3 py-2">Baris</th><th>Tipe</th><th>Pertanyaan</th><th>Kunci</th><th className="pr-3">Keterangan</th></tr></thead>
              <tbody>
                {parsed.map((p) => (
                  <tr key={p.row} className={cn('border-b border-slate-100', p.errors.length && 'bg-red-50/60')}>
                    <td className="px-3 py-1.5 font-mono text-xs">{p.row}</td>
                    <td>{p.question ? <Badge tone="blue">{TYPE_LABEL[qType(p.question)]}</Badge> : <span className="text-xs text-slate-500">{p.raw.tipe || '-'}</span>}</td>
                    <td className="max-w-xs truncate">{p.question?.q || p.raw.q || '-'}</td>
                    <td className="text-xs">{p.question ? keyText(p.question) : '-'}</td>
                    <td className="pr-3 text-xs text-red-600">{p.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

export function keyText(q: Question) {
  const t = qType(q);
  if (t === 'pgk') return (q.answers || []).map((i) => LETTERS[i]).join(', ');
  if (t === 'bs') return q.answer === 0 ? 'Benar' : 'Salah';
  if (t === 'esai') return q.key ? `Rubrik: ${q.key.slice(0, 40)}${q.key.length > 40 ? '…' : ''}` : 'Dinilai guru';
  return LETTERS[q.answer] || '-';
}

/* ------------------------------------------------------------------ Editor */
/** Editor soal (ujian CBT & kuis e-learning). allowEssay=false untuk kuis yang dinilai otomatis. */
export function QuestionEditor({ questions, onChange, allowEssay = true }: { questions: Question[]; onChange: (qs: Question[]) => void; allowEssay?: boolean }) {
  const [upload, setUpload] = useState(false);
  const setQ = (i: number, q: Partial<Question>) => onChange(questions.map((x, j) => (j === i ? { ...x, ...q } : x)));
  const types = (Object.keys(TYPE_LABEL) as QuestionType[]).filter((t) => allowEssay || t !== 'esai');
  const total = questions.reduce((a, q) => a + qPoints(q), 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">Soal ({questions.length}) <span className="text-sm font-normal text-slate-500">· total bobot {total} poin</span></p>
        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setUpload(true)}><Upload className="h-4 w-4" /> Unggah Soal (Excel/CSV)</Button>
      </div>
      {questions.map((q, i) => {
        const t = qType(q);
        return (
          <div key={i} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-start gap-2">
              <span className="pt-2 text-sm font-bold text-slate-500">{i + 1}.</span>
              <Select className="w-44" value={t} onChange={(e) => onChange(questions.map((x, j) => (j === i ? convert(x, e.target.value as QuestionType) : x)))} options={types.map((x) => ({ value: x, label: TYPE_LABEL[x] }))} />
              <div className="flex items-center gap-1 text-xs text-slate-500">Bobot <Input type="number" min={1} className="w-20" value={q.points ?? qPoints(q)} onChange={(e) => setQ(i, { points: Number(e.target.value) })} /></div>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onChange(questions.filter((_, j) => j !== i))} title="Hapus soal"><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </div>
            <Textarea className="mt-2" rows={2} value={q.q} placeholder={t === 'bs' ? 'Pernyataan yang dinilai benar/salah' : 'Pertanyaan'} onChange={(x) => setQ(i, { q: x.target.value })} />
            {(t === 'pg' || t === 'pgk') && (
              <>
                <p className="mt-2 text-xs text-slate-500">{t === 'pg' ? 'Pilih satu kunci jawaban (radio).' : 'Centang semua jawaban yang benar. Nilai penuh bila seluruh pilihan siswa tepat.'}</p>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {q.options.map((o, k) => (
                    <label key={k} className="flex items-center gap-2">
                      {t === 'pg'
                        ? <input type="radio" name={`ans-${i}`} checked={q.answer === k} onChange={() => setQ(i, { answer: k })} title="Kunci jawaban" />
                        : <input type="checkbox" checked={(q.answers || []).includes(k)} onChange={(e) => setQ(i, { answers: e.target.checked ? [...(q.answers || []), k] : (q.answers || []).filter((x) => x !== k) })} title="Kunci jawaban" />}
                      <span className="text-sm font-semibold">{LETTERS[k]}</span>
                      <Input value={o} onChange={(x) => setQ(i, { options: q.options.map((y, m) => (m === k ? x.target.value : y)) })} />
                      {q.options.length > 2 && <button type="button" className="text-slate-400 hover:text-red-500" title="Hapus opsi" onClick={() => setQ(i, { options: q.options.filter((_, m) => m !== k), answer: q.answer === k ? 0 : q.answer > k ? q.answer - 1 : q.answer, answers: (q.answers || []).filter((x) => x !== k).map((x) => (x > k ? x - 1 : x)) })}>×</button>}
                    </label>
                  ))}
                </div>
                {q.options.length < 5 && <button type="button" className="mt-2 text-xs font-medium text-brand-600 hover:underline" onClick={() => setQ(i, { options: [...q.options, ''] })}>+ Tambah opsi</button>}
              </>
            )}
            {t === 'bs' && (
              <div className="mt-2 flex gap-2">
                {['Benar', 'Salah'].map((label, k) => (
                  <label key={label} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm', q.answer === k ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200')}>
                    <input type="radio" name={`bs-${i}`} checked={q.answer === k} onChange={() => setQ(i, { answer: k })} /> Kunci: {label}
                  </label>
                ))}
              </div>
            )}
            {t === 'esai' && <Textarea className="mt-2" rows={2} value={q.key || ''} placeholder="Kunci jawaban / rubrik penilaian (hanya terlihat oleh guru)" onChange={(x) => setQ(i, { key: x.target.value })} />}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        {types.map((t) => <Button key={t} size="sm" variant="secondary" onClick={() => onChange([...questions, emptyQuestion(t)])}><Plus className="h-4 w-4" /> {TYPE_LABEL[t]}</Button>)}
      </div>
      <p className="text-xs text-slate-500">Soal objektif dinilai otomatis.{allowEssay && ' Soal esai dikoreksi guru di menu Hasil; nilai siswa berstatus "menunggu koreksi" sampai esai dinilai.'}</p>
      {upload && <QuestionUpload allowEssay={allowEssay} onClose={() => setUpload(false)} onAdd={(qs, replace) => { onChange(replace ? qs : [...questions, ...qs]); toast.success(`${qs.length} soal ditambahkan`); }} />}
    </div>
  );
}
