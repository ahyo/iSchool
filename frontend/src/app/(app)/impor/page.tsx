'use client';
import { useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, Download, FileSpreadsheet, GraduationCap, History, RotateCcw, Upload, Users, UserSquare2 } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, Loading, PageHeader, StatCard, Tabs, toast } from '@/components/ui';
import { IMPORT_SPECS, normalizeHeader, type ImportKind, type ImportResult } from '@/lib/importSpec';
import { cn, downloadCSV } from '@/lib/utils';

const KINDS: { kind: ImportKind; icon: React.ElementType; roles: string[] }[] = [
  { kind: 'siswa', icon: Users, roles: ['admin', 'kesiswaan'] },
  { kind: 'pegawai', icon: UserSquare2, roles: ['admin'] },
  { kind: 'riwayat_kelas', icon: History, roles: ['admin', 'kesiswaan'] },
  { kind: 'nilai', icon: GraduationCap, roles: ['admin', 'kesiswaan'] },
  { kind: 'buku', icon: BookOpen, roles: ['admin', 'pustakawan'] },
];

type Rows = Record<string, unknown>[];

export default function ImporPage() {
  const { user } = useAuth();
  const { data } = useData(['units', 'classes', 'subjects']);
  const [kind, setKind] = useState<ImportKind>(user?.role === 'pustakawan' ? 'buku' : 'siswa');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Rows | null>(null);
  const [check, setCheck] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'semua' | 'error'>('semua');
  if (!data || !user) return <Loading />;
  const spec = IMPORT_SPECS[kind];
  const kinds = KINDS.filter((k) => k.roles.includes(user.role));

  const reset = () => { setRows(null); setCheck(null); setDone(null); setFileName(''); setFilter('semua'); };

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([spec.columns.map((c) => c.label)]), 'Data');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Kolom', 'Wajib', 'Keterangan', 'Contoh'],
      ...spec.columns.map((c) => [c.label, c.required ? 'Ya' : '', c.hint, c.example]),
      [], ['Catatan', '', spec.keyInfo], ['', '', 'Isi data mulai baris ke-2 pada sheet "Data". Jangan mengubah judul kolom.'],
    ]), 'Petunjuk');
    const ref: (string | number)[][] = [['Unit', 'Kelas Aktif', '', 'Unit', 'Kode Mapel', 'Nama Mapel']];
    const units = new Map(data.units.map((u) => [u.id, u.code]));
    const cls = data.classes.map((c) => [units.get(c.unit_id) || '', c.name]);
    const subs = data.subjects.map((s) => [units.get(s.unit_id) || '', s.code, s.name]);
    for (let i = 0; i < Math.max(cls.length, subs.length); i++) ref.push([...(cls[i] || ['', '']), '', ...(subs[i] || ['', '', ''])]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ref), 'Referensi');
    XLSX.writeFile(wb, `template-impor-${kind}.xlsx`);
  };

  const onFile = async (file: File) => {
    reset();
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const ws = wb.Sheets['Data'] || wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
      const parsed = raw
        .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [normalizeHeader(k, kind), typeof v === 'string' ? v.trim() : v])))
        .filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));
      if (!parsed.length) throw new Error('File tidak berisi data. Isi data mulai baris ke-2 pada sheet "Data".');
      const missing = spec.columns.filter((c) => c.required && !(c.key in parsed[0]));
      if (missing.length) throw new Error(`Kolom wajib tidak ditemukan: ${missing.map((c) => c.label).join(', ')}. Gunakan template yang disediakan.`);
      setFileName(file.name);
      setRows(parsed);
      setCheck(await api.action<ImportResult>('import.run', { kind, rows: parsed, dry_run: true }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!rows) return;
    setBusy(true);
    try {
      const r = await api.action<ImportResult>('import.run', { kind, rows, dry_run: false });
      setDone(r);
      toast.success(`${r.created + r.updated} baris berhasil diimpor`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const result = done || check;
  const shown = result ? result.rows.filter((r) => filter === 'semua' || r.status === 'error') : [];

  return (
    <>
      <PageHeader title="Impor Data" subtitle="Impor siswa, pegawai, riwayat kelas, dan nilai rapor lama dari Excel (.xlsx) atau CSV" />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kinds.map((k) => (
          <button key={k.kind} onClick={() => { setKind(k.kind); reset(); }} className={cn('flex items-start gap-3 rounded-xl border-2 bg-white p-4 text-left transition', kind === k.kind ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300')}>
            <k.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <span><span className="block font-semibold">{IMPORT_SPECS[k.kind].title}</span><span className="text-xs text-slate-500">{IMPORT_SPECS[k.kind].columns.length} kolom</span></span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="1. Unduh Template">
          <p className="text-sm text-slate-600">{spec.description}</p>
          <p className="mt-2 text-sm text-slate-600">{spec.keyInfo}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={downloadTemplate}><FileSpreadsheet className="h-4 w-4" /> Template Excel</Button>
            <Button variant="secondary" onClick={() => downloadCSV(`template-impor-${kind}.csv`, [spec.columns.map((c) => c.label)])}><Download className="h-4 w-4" /> CSV</Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Template Excel berisi sheet <b>Data</b>, <b>Petunjuk</b> (penjelasan kolom & contoh), dan <b>Referensi</b> (daftar kelas & kode mapel).</p>
        </Card>

        <Card title="2. Kolom" className="lg:col-span-2" bodyClass="p-0 max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white"><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="px-4 py-2">Kolom</th><th>Keterangan</th><th className="pr-4">Contoh</th></tr></thead>
            <tbody>
              {spec.columns.map((c) => (
                <tr key={c.key} className="border-b border-slate-100">
                  <td className="whitespace-nowrap px-4 py-1.5 font-medium">{c.label}{c.required && <span className="text-red-500"> *</span>}</td>
                  <td className="text-slate-600">{c.hint || '-'}</td>
                  <td className="pr-4 font-mono text-xs text-slate-500">{c.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="3. Unggah & Periksa" className="mt-4" actions={(rows || done) && <Button size="sm" variant="ghost" onClick={reset}><RotateCcw className="h-4 w-4" /> Ulangi</Button>}>
        {!rows && (
          <label className={cn('flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-brand-400 hover:bg-brand-50/40', busy && 'pointer-events-none opacity-60')}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
            <Upload className="mb-2 h-8 w-8 text-slate-400" />
            <p className="font-medium">{busy ? 'Membaca & memeriksa file...' : 'Klik atau seret file ke sini'}</p>
            <p className="text-sm text-slate-500">Format .xlsx, .xls, atau .csv — data {spec.title.toLowerCase()}</p>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
          </label>
        )}

        {result && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> <b>{fileName}</b>
              {done ? <Badge tone="green">Selesai diimpor</Badge> : <Badge tone="amber">Pratinjau — belum disimpan</Badge>}
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard label="Total Baris" value={result.total} tone="blue" />
              <StatCard label={done ? 'Ditambahkan' : 'Akan Ditambahkan'} value={result.created} tone="green" />
              <StatCard label={done ? 'Diperbarui' : 'Akan Diperbarui'} value={result.updated} tone="violet" />
              <StatCard label="Baris Error" value={result.failed} tone={result.failed ? 'red' : 'slate'} hint={result.failed ? 'dilewati saat impor' : undefined} />
              {done && <StatCard label="Akun Login Dibuat" value={result.accounts} tone="amber" hint="password awal demo123" />}
            </div>
            {!done && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                {result.failed ? <><AlertTriangle className="h-4 w-4 text-amber-500" /> {result.failed} baris bermasalah akan dilewati. Perbaiki di file lalu unggah ulang, atau lanjutkan impor baris yang valid.</> : <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Semua baris valid.</>}
                <Button className="ml-auto" loading={busy} disabled={!result.valid} onClick={commit}><Upload className="h-4 w-4" /> Impor {result.valid} Baris Valid</Button>
              </div>
            )}
            <Tabs value={filter} onChange={setFilter} tabs={[{ value: 'semua', label: `Semua (${result.total})` }, { value: 'error', label: `Error (${result.failed})` }]} />
            <div className="max-h-[28rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white"><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="w-16 py-2">Baris</th><th>Data</th><th className="w-28">Status</th><th>Keterangan</th></tr></thead>
                <tbody>
                  {shown.slice(0, 500).map((r) => (
                    <tr key={r.row} className={cn('border-b border-slate-100', r.status === 'error' && 'bg-red-50/50')}>
                      <td className="py-1.5 font-mono text-xs text-slate-500">{r.row}</td>
                      <td>{r.label}</td>
                      <td>{r.status === 'error' ? <Badge tone="red">Error</Badge> : r.status === 'perbarui' ? <Badge tone="violet">Perbarui</Badge> : <Badge tone="green">Baru</Badge>}</td>
                      <td className="text-xs text-red-600">{r.errors.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {shown.length > 500 && <p className="py-2 text-center text-xs text-slate-500">Menampilkan 500 dari {shown.length} baris</p>}
            </div>
            {result.failed > 0 && (
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => downloadCSV(`error-impor-${kind}.csv`, [['Baris', 'Data', 'Keterangan'], ...result.rows.filter((r) => r.status === 'error').map((r) => [r.row, r.label, r.errors.join('; ')])])}><Download className="h-4 w-4" /> Unduh Daftar Error</Button>
            )}
          </>
        )}
      </Card>
    </>
  );
}
