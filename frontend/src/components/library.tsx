'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AlertTriangle, ArrowRightLeft, BookCheck, BookMarked, BookOpen, BookPlus, CalendarClock, Download, Library, Pencil, RotateCcw, Search, Trash2, Users, Wallet, X } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { useAuth, useWorkspace } from '@/lib/auth';
import type { Book, BookLoan, BookReservation, DB, Employee, Student } from '@/lib/types';
import { availableCopies, lateDays, LIB_STAFF, loanFine, loanStatus, pendingReservations } from '@/lib/library';
import { addDays, cn, downloadCSV, fmtDate, fmtDateTime, nowISO, rupiah, today } from '@/lib/utils';
import { Avatar, Badge, Button, Card, DataTable, Empty, Field, Input, Modal, SearchInput, Select, StatCard, Tabs, run, type Column } from './ui';
import { FormModal } from './FormModal';
import { BarsChart, DonutChart } from './charts';

type LibData = Pick<DB, 'books' | 'book_loans' | 'book_reservations' | 'students' | 'employees' | 'classes' | 'settings' | 'units'>;
export const LIB_KEYS = ['books', 'book_loans', 'book_reservations', 'students', 'employees', 'classes', 'settings', 'units'] as const;
const CATEGORIES: Book['category'][] = ['Fiksi', 'Nonfiksi', 'Buku Pelajaran', 'Referensi', 'Majalah', 'Buku Anak'];
const COVER: Record<string, string> = {
  Fiksi: 'from-rose-500 to-orange-400', Nonfiksi: 'from-sky-600 to-cyan-500', 'Buku Pelajaran': 'from-brand-600 to-indigo-500',
  Referensi: 'from-emerald-600 to-teal-500', Majalah: 'from-fuchsia-500 to-pink-500', 'Buku Anak': 'from-amber-500 to-yellow-400',
};

export function BookCover({ book, className, small }: { book: Book; className?: string; small?: boolean }) {
  if (book.cover_url) return <img src={book.cover_url} alt={book.title} className={cn('aspect-[3/4] w-full rounded-lg object-cover shadow-sm', className)} />;
  if (small) return <div className={cn('flex aspect-[3/4] w-full items-center justify-center rounded-md bg-gradient-to-br text-white shadow-sm', COVER[book.category], className)}><BookOpen className="h-1/3 w-1/3" /></div>;
  return (
    <div className={cn('flex aspect-[3/4] w-full flex-col justify-between rounded-lg bg-gradient-to-br p-3 text-white shadow-sm', COVER[book.category], className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{book.category}</span>
      <span className="line-clamp-4 text-sm font-bold leading-tight">{book.title}</span>
      <span className="line-clamp-1 text-[11px] opacity-90">{book.author}</span>
    </div>
  );
}

function borrowerOf(l: { student_id: number | null; employee_id: number | null }, d: LibData) {
  if (l.student_id) {
    const s = d.students.find((x) => x.id === l.student_id);
    return { name: s?.name || '-', sub: `${d.classes.find((c) => c.id === s?.class_id)?.name || 'Siswa'} · ${s?.nis || ''}` };
  }
  const e = d.employees.find((x) => x.id === l.employee_id);
  return { name: e?.name || '-', sub: e?.position || 'Pegawai' };
}

function StatusChip({ loan }: { loan: BookLoan }) {
  const s = loanStatus(loan);
  return s === 'kembali' ? <Badge tone="slate">Dikembalikan</Badge> : s === 'terlambat' ? <Badge tone="red">Terlambat {lateDays(loan)} hari</Badge> : <Badge tone="blue">Dipinjam</Badge>;
}

/* ================================ KATALOG ================================ */
export function Catalog({ d, canManage, reserveAs }: { d: LibData; canManage: boolean; reserveAs?: { student_id?: number; employee_id?: number } }) {
  const { unitId } = useWorkspace();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [view, setView] = useState<Book | null>(null);
  const [edit, setEdit] = useState<Partial<Book> | null>(null);
  const books = d.books
    .filter((b) => !unitId || !b.unit_id || b.unit_id === unitId)
    .filter((b) => !cat || b.category === cat)
    .filter((b) => !q || [b.title, b.author, b.code, b.isbn, b.publisher].some((x) => x.toLowerCase().includes(q.toLowerCase())))
    .filter((b) => !onlyAvail || availableCopies(b, d.book_loans) > 0)
    .sort((a, b) => a.title.localeCompare(b.title));
  const cur = view ? d.books.find((b) => b.id === view.id) || null : null;
  const myResv = (bookId: number) => d.book_reservations.find((r) => r.book_id === bookId && r.status === 'menunggu' && (reserveAs?.student_id ? r.student_id === reserveAs.student_id : r.employee_id === reserveAs?.employee_id));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Cari judul, pengarang, kode, ISBN" />
        <Select className="w-44" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Semua kategori" options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} /> Hanya yang tersedia</label>
        <span className="text-sm text-slate-500">{books.length} judul</span>
        {canManage && <Button className="ml-auto" onClick={() => setEdit({ category: 'Fiksi', copies: 1, unit_id: unitId || null })}><BookPlus className="h-4 w-4" /> Tambah Buku</Button>}
      </div>
      {books.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {books.map((b) => {
            const avail = availableCopies(b, d.book_loans);
            return (
              <button key={b.id} onClick={() => setView(b)} className="group flex flex-col self-start text-left">
                <BookCover book={b} className="transition group-hover:-translate-y-0.5 group-hover:shadow-md" />
                <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight">{b.title}</p>
                <p className="line-clamp-1 text-xs text-slate-500">{b.author}</p>
                <p className="mt-1"><Badge tone={avail > 0 ? 'green' : 'red'}>{avail > 0 ? `Tersedia ${avail}/${b.copies}` : 'Sedang dipinjam'}</Badge></p>
              </button>
            );
          })}
        </div>
      ) : <Card><Empty text="Buku tidak ditemukan" /></Card>}

      <Modal open={!!cur} onClose={() => setView(null)} title="Detail Buku" size="lg">
        {cur && (() => {
          const avail = availableCopies(cur, d.book_loans);
          const active = d.book_loans.filter((l) => l.book_id === cur.id && !l.returned_at);
          const queue = pendingReservations(cur.id, d.book_reservations);
          const mine = myResv(cur.id);
          const nextDue = active.map((l) => l.due_date).sort()[0];
          return (
            <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
              <BookCover book={cur} />
              <div className="text-sm">
                <p className="text-lg font-bold">{cur.title}</p>
                <p className="text-slate-600">{cur.author}</p>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
                  {[['Kode', cur.code], ['Kategori', cur.category], ['Penerbit', cur.publisher || '-'], ['Tahun', cur.year || '-'], ['ISBN', cur.isbn || '-'], ['Lokasi', cur.location || '-'], ['Unit', cur.unit_id ? d.units.find((u) => u.id === cur.unit_id)?.code : 'Semua unit'], ['Eksemplar', cur.copies]].map(([k, v]) => (
                    <p key={k as string}><span className="text-slate-500">{k}:</span> <span className="font-medium">{v}</span></p>
                  ))}
                </div>
                {cur.description && <p className="mt-3 text-slate-700">{cur.description}</p>}
                <div className={cn('mt-4 rounded-lg p-3', avail > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>
                  {avail > 0 ? `${avail} dari ${cur.copies} eksemplar tersedia di ${cur.location || 'perpustakaan'}.` : `Semua eksemplar sedang dipinjam${nextDue ? `, paling cepat kembali ${fmtDate(nextDue)}` : ''}.`}
                  {queue.length > 0 && ` ${queue.length} antrean reservasi.`}
                </div>
                {canManage && active.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 font-semibold">Sedang dipinjam oleh</p>
                    {active.map((l) => { const w = borrowerOf(l, d); return <p key={l.id} className="text-slate-600">• {w.name} ({w.sub}) — kembali {fmtDate(l.due_date)}</p>; })}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {reserveAs && (mine
                    ? <Button variant="secondary" onClick={() => run(() => api.action('library.cancelReservation', { id: mine.id }), 'Reservasi dibatalkan')}><X className="h-4 w-4" /> Batalkan Reservasi</Button>
                    : <Button onClick={() => run(() => api.action('library.reserve', { book_id: cur.id }), 'Reservasi dikirim — ambil buku di perpustakaan')}><BookMarked className="h-4 w-4" /> Reservasi Buku</Button>)}
                  {canManage && <Button variant="secondary" onClick={() => { setEdit(cur); setView(null); }}><Pencil className="h-4 w-4" /> Ubah</Button>}
                  {canManage && <Button variant="ghost" onClick={() => { if (d.book_loans.some((l) => l.book_id === cur.id)) return run(async () => { throw new Error('Buku memiliki riwayat peminjaman; kurangi jumlah eksemplar alih-alih menghapus'); }); if (confirm('Hapus buku ini?')) run(async () => { await api.remove('books', cur.id); setView(null); }, 'Buku dihapus'); }}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      <FormModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah Buku' : 'Tambah Buku'} initial={edit || undefined}
        fields={[
          { name: 'title', label: 'Judul', required: true, full: true },
          { name: 'author', label: 'Pengarang' },
          { name: 'publisher', label: 'Penerbit' },
          { name: 'code', label: 'Kode Buku', required: true, hint: 'Unik, mis. FIK-030' },
          { name: 'isbn', label: 'ISBN' },
          { name: 'category', label: 'Kategori', type: 'select', options: CATEGORIES.map((c) => ({ value: c, label: c })), required: true },
          { name: 'year', label: 'Tahun Terbit', type: 'number' },
          { name: 'copies', label: 'Jumlah Eksemplar', type: 'number', required: true },
          { name: 'location', label: 'Lokasi Rak' },
          { name: 'unit_id', label: 'Unit', type: 'select', options: d.units.map((u) => ({ value: u.id, label: u.name })), placeholder: 'Semua unit' },
          { name: 'cover_url', label: 'URL Gambar Sampul', hint: 'Opsional' },
          { name: 'description', label: 'Sinopsis / Deskripsi', type: 'textarea' },
        ]}
        onSubmit={(v) => run(async () => {
          if (!v.copies || v.copies < 1) throw new Error('Jumlah eksemplar minimal 1');
          if (d.books.some((b) => b.code.toLowerCase() === String(v.code).toLowerCase() && b.id !== v.id)) throw new Error('Kode buku sudah dipakai');
          if (v.id) {
            const onLoan = d.book_loans.filter((l) => l.book_id === v.id && !l.returned_at).length;
            if (v.copies < onLoan) throw new Error(`Jumlah eksemplar tidak boleh kurang dari yang sedang dipinjam (${onLoan})`);
          }
          const payload = { ...v, author: v.author || '', publisher: v.publisher || '', isbn: v.isbn || '', location: v.location || '', cover_url: v.cover_url || '', description: v.description || '' };
          if (v.id) await api.update('books', v.id, payload);
          else await api.create('books', { ...payload, created_at: nowISO() });
          setEdit(null);
        }, 'Data buku disimpan')} />
    </>
  );
}

/* ================================ SIRKULASI ================================ */
function Picker<T extends { id: number }>({ label, items, render, search, value, onChange, placeholder }: { label: string; items: T[]; render: (x: T) => React.ReactNode; search: (x: T) => string; value: T | null; onChange: (x: T | null) => void; placeholder: string }) {
  const [q, setQ] = useState('');
  const results = q.trim().length >= 2 ? items.filter((x) => search(x).toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  return (
    <Field label={label}>
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-sm">
          <div className="min-w-0 flex-1">{render(value)}</div>
          <button onClick={() => onChange(null)} className="text-slate-400 hover:text-slate-700" aria-label="Ganti"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              {results.map((x) => <button key={x.id} onClick={() => { onChange(x); setQ(''); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">{render(x)}</button>)}
            </div>
          )}
        </div>
      )}
    </Field>
  );
}

export function Circulation({ d }: { d: LibData }) {
  const cfg = d.settings[0];
  const [type, setType] = useState<'siswa' | 'pegawai'>('siswa');
  const [student, setStudent] = useState<Student | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [filter, setFilter] = useState<'semua' | 'terlambat' | 'segera'>('semua');
  const [q, setQ] = useState('');
  const [ret, setRet] = useState<{ loan: BookLoan; pay: boolean } | null>(null);
  const active = d.book_loans.filter((l) => !l.returned_at);
  const unpaid = d.book_loans.filter((l) => l.returned_at && l.fine > 0 && !l.fine_paid);
  const borrowerLoans = d.book_loans.filter((l) => (type === 'siswa' ? student && l.student_id === student.id : employee && l.employee_id === employee.id));
  const warnings: string[] = [];
  const bActive = borrowerLoans.filter((l) => !l.returned_at);
  if (student || employee) {
    if (bActive.length >= cfg.library_max_loans) warnings.push(`Sudah meminjam ${bActive.length} buku (batas ${cfg.library_max_loans})`);
    if (bActive.some((l) => l.due_date < today())) warnings.push('Masih ada buku terlambat');
    const fine = borrowerLoans.filter((l) => l.fine > 0 && !l.fine_paid).reduce((a, l) => a + l.fine, 0);
    if (fine) warnings.push(`Denda belum dibayar ${rupiah(fine)}`);
  }
  if (book && availableCopies(book, d.book_loans) <= 0) warnings.push('Semua eksemplar buku ini sedang dipinjam');

  const rows = active
    .filter((l) => filter === 'semua' || (filter === 'terlambat' ? l.due_date < today() : l.due_date >= today() && l.due_date <= addDays(today(), 2)))
    .filter((l) => !q || `${borrowerOf(l, d).name} ${d.books.find((b) => b.id === l.book_id)?.title}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const title = (id: number) => d.books.find((b) => b.id === id)?.title || '-';
  const cols: Column<BookLoan>[] = [
    { key: 'borrower', header: 'Peminjam', render: (l) => { const w = borrowerOf(l, d); return <div><p className="font-medium">{w.name}</p><p className="text-xs text-slate-500">{w.sub}</p></div>; } },
    { key: 'book', header: 'Buku', render: (l) => <span className="line-clamp-2">{title(l.book_id)}</span> },
    { key: 'borrowed_at', header: 'Dipinjam', render: (l) => fmtDate(l.borrowed_at) },
    { key: 'due_date', header: 'Jatuh Tempo', render: (l) => <span className={cn(l.due_date < today() && 'font-semibold text-red-600')}>{fmtDate(l.due_date)}{l.extended && <span className="ml-1 text-xs text-slate-400">(diperpanjang)</span>}</span> },
    { key: 'status', header: 'Status', render: (l) => <StatusChip loan={l} /> },
    { key: 'fine', header: 'Denda', render: (l) => (loanFine(l, cfg.library_fine_per_day) ? <span className="text-red-600">{rupiah(loanFine(l, cfg.library_fine_per_day))}</span> : '-') },
    { key: 'a', header: '', render: (l) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" onClick={() => setRet({ loan: l, pay: true })}><RotateCcw className="h-4 w-4" /> Kembali</Button>
        {!l.extended && l.due_date >= today() && <Button size="sm" variant="ghost" onClick={() => run(() => api.action('library.extend', { loan_id: l.id }), 'Peminjaman diperpanjang')}>Perpanjang</Button>}
      </div>
    ) },
  ];

  const borrow = () => run(async () => {
    await api.action('library.borrow', { book_id: book?.id, student_id: type === 'siswa' ? student?.id : null, employee_id: type === 'pegawai' ? employee?.id : null });
    setBook(null);
  }, `Peminjaman dicatat — kembali ${fmtDate(addDays(today(), cfg.library_loan_days))}`);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sedang Dipinjam" value={active.length} icon={BookOpen} tone="blue" />
        <StatCard label="Terlambat" value={active.filter((l) => l.due_date < today()).length} icon={AlertTriangle} tone="red" />
        <StatCard label="Jatuh Tempo ≤ 2 Hari" value={active.filter((l) => l.due_date >= today() && l.due_date <= addDays(today(), 2)).length} icon={CalendarClock} tone="amber" />
        <StatCard label="Denda Belum Dibayar" value={rupiah(unpaid.reduce((a, l) => a + l.fine, 0) + active.reduce((a, l) => a + loanFine(l, cfg.library_fine_per_day), 0))} icon={Wallet} tone="violet" hint={`${cfg.library_fine_per_day.toLocaleString('id-ID')}/hari keterlambatan`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Card title={<span className="flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Catat Peminjaman</span>} className="self-start">
          <div className="space-y-3">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
              {(['siswa', 'pegawai'] as const).map((t) => <button key={t} onClick={() => { setType(t); setStudent(null); setEmployee(null); }} className={cn('flex-1 rounded-md py-1.5 font-medium', type === t ? 'bg-white shadow-sm' : 'text-slate-500')}>{t === 'siswa' ? 'Siswa' : 'Guru/Pegawai'}</button>)}
            </div>
            {type === 'siswa'
              ? <Picker label="Peminjam" items={d.students.filter((s) => s.status === 'aktif')} value={student} onChange={setStudent} placeholder="Ketik nama / NIS siswa" search={(s) => `${s.name} ${s.nis}`} render={(s) => <><p className="font-medium">{s.name}</p><p className="text-xs text-slate-500">{d.classes.find((c) => c.id === s.class_id)?.name} · NIS {s.nis}</p></>} />
              : <Picker label="Peminjam" items={d.employees.filter((e) => e.is_active)} value={employee} onChange={setEmployee} placeholder="Ketik nama / NIP" search={(e) => `${e.name} ${e.nip}`} render={(e) => <><p className="font-medium">{e.name}</p><p className="text-xs text-slate-500">{e.position}</p></>} />}
            {bActive.length > 0 && <p className="text-xs text-slate-500">Sedang meminjam: {bActive.map((l) => title(l.book_id)).join(', ')}</p>}
            <Picker label="Buku" items={d.books} value={book} onChange={setBook} placeholder="Ketik judul / kode / ISBN" search={(b) => `${b.title} ${b.code} ${b.isbn} ${b.author}`}
              render={(b) => <><p className="font-medium">{b.title}</p><p className="text-xs text-slate-500">{b.code} · {b.location} · tersedia {availableCopies(b, d.book_loans)}/{b.copies}</p></>} />
            {warnings.map((w) => <p key={w} className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800"><AlertTriangle className="h-3.5 w-3.5" /> {w}</p>)}
            <p className="text-xs text-slate-500">Lama pinjam {cfg.library_loan_days} hari → kembali <b>{fmtDate(addDays(today(), cfg.library_loan_days))}</b></p>
            <Button className="w-full" disabled={!book || !(student || employee) || warnings.length > 0} onClick={borrow}><BookCheck className="h-4 w-4" /> Pinjamkan</Button>
          </div>
        </Card>
        <Card title="Peminjaman Aktif" actions={<SearchInput value={q} onChange={setQ} placeholder="Cari peminjam / judul" />}>
          <Tabs value={filter} onChange={setFilter} tabs={[{ value: 'semua', label: `Semua (${active.length})` }, { value: 'terlambat', label: `Terlambat (${active.filter((l) => l.due_date < today()).length})` }, { value: 'segera', label: 'Jatuh tempo ≤ 2 hari' }]} />
          <DataTable rows={rows} columns={cols} pageSize={10} empty="Tidak ada peminjaman" />
        </Card>
      </div>
      {unpaid.length > 0 && (
        <Card title="Denda Belum Dibayar" className="mt-4" bodyClass="p-0">
          <div className="divide-y divide-slate-100">
            {unpaid.map((l) => { const w = borrowerOf(l, d); return (
              <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="flex-1"><b>{w.name}</b> <span className="text-slate-500">· {title(l.book_id)} · kembali {fmtDate(l.returned_at)} ({lateDays(l)} hari terlambat)</span></span>
                {l.bill_id && <Badge tone="violet">Tertagih di Keuangan</Badge>}
                <span className="font-semibold text-red-600">{rupiah(l.fine)}</span>
                <Button size="sm" variant="secondary" onClick={() => run(() => api.action('library.payFine', { loan_id: l.id }), 'Denda lunas — pembayaran tercatat di keuangan')}>Lunasi</Button>
              </div>
            ); })}
          </div>
        </Card>
      )}
      <Modal open={!!ret} onClose={() => setRet(null)} title="Pengembalian Buku" size="sm" footer={<Button onClick={() => run(async () => { await api.action('library.return', { loan_id: ret!.loan.id, pay_fine: ret!.pay }); setRet(null); }, 'Buku dikembalikan')}>Konfirmasi Pengembalian</Button>}>
        {ret && (() => {
          const days = lateDays(ret.loan);
          const fine = days * cfg.library_fine_per_day;
          return (
            <div className="space-y-3 text-sm">
              <p><b>{title(ret.loan.book_id)}</b></p>
              <p>Peminjam: {borrowerOf(ret.loan, d).name}</p>
              <p>Jatuh tempo {fmtDate(ret.loan.due_date)} · {days ? <span className="font-semibold text-red-600">terlambat {days} hari</span> : <span className="text-emerald-600">tepat waktu</span>}</p>
              {fine > 0 && (
                <div className="rounded-lg bg-red-50 p-3">
                  <p className="font-semibold text-red-700">Denda {rupiah(fine)}</p>
                  <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={ret.pay} onChange={(e) => setRet({ ...ret, pay: e.target.checked })} /> Denda dibayar tunai sekarang</label>
                  {ret.loan.student_id && <p className="mt-2 text-xs text-slate-600">{ret.pay ? 'Pembayaran tercatat sebagai pemasukan di modul Keuangan (kwitansi tersedia).' : 'Denda menjadi tagihan "Denda Perpustakaan" yang dapat dibayar orang tua/siswa lewat menu Tagihan.'}</p>}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </>
  );
}

/* ================================ RESERVASI ================================ */
export function Reservations({ d }: { d: LibData }) {
  const title = (id: number) => d.books.find((b) => b.id === id);
  const list = [...d.book_reservations].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const pending = list.filter((r) => r.status === 'menunggu');
  const done = list.filter((r) => r.status !== 'menunggu').reverse().slice(0, 30);
  const row = (r: BookReservation, actions: boolean) => {
    const b = title(r.book_id)!;
    const w = borrowerOf(r, d);
    const avail = availableCopies(b, d.book_loans);
    return (
      <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
        <div className="w-10 shrink-0"><BookCover book={b} small /></div>
        <div className="min-w-[200px] flex-1">
          <p className="font-medium">{b.title}</p>
          <p className="text-xs text-slate-500">{w.name} · {w.sub} · {fmtDateTime(r.created_at)}</p>
        </div>
        {actions ? (
          <>
            <Badge tone={avail > 0 ? 'green' : 'amber'}>{avail > 0 ? `Tersedia (${b.location})` : 'Belum tersedia'}</Badge>
            <Button size="sm" disabled={avail <= 0} onClick={() => run(() => api.action('library.borrow', { book_id: b.id, student_id: r.student_id, employee_id: r.employee_id, reservation_id: r.id }), 'Buku dipinjamkan')}><BookCheck className="h-4 w-4" /> Pinjamkan</Button>
            <Button size="sm" variant="ghost" onClick={() => confirm('Batalkan reservasi?') && run(() => api.action('library.cancelReservation', { id: r.id }), 'Reservasi dibatalkan')}>Batalkan</Button>
          </>
        ) : <Badge tone={r.status === 'dipinjam' ? 'green' : 'slate'}>{r.status === 'dipinjam' ? 'Sudah dipinjam' : 'Dibatalkan'}</Badge>}
      </div>
    );
  };
  return (
    <>
      <Card title={`Reservasi Menunggu (${pending.length})`} bodyClass="p-0">
        <div className="divide-y divide-slate-100">{pending.map((r) => row(r, true))}</div>
        {!pending.length && <Empty text="Tidak ada reservasi yang menunggu" />}
      </Card>
      <Card title="Riwayat Reservasi" className="mt-4" bodyClass="p-0">
        <div className="divide-y divide-slate-100">{done.map((r) => row(r, false))}</div>
        {!done.length && <Empty />}
      </Card>
    </>
  );
}

/* ================================ LAPORAN ================================ */
export function LibraryReport({ d, compact }: { d: LibData; compact?: boolean }) {
  const loans = d.book_loans;
  const since = addDays(today(), -30);
  const titleCount = new Map<number, number>();
  loans.forEach((l) => titleCount.set(l.book_id, (titleCount.get(l.book_id) || 0) + 1));
  const topBooks = [...titleCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ label: d.books.find((b) => b.id === id)?.title.slice(0, 22) || '', Peminjaman: n }));
  const readerCount = new Map<number, number>();
  loans.filter((l) => l.student_id).forEach((l) => readerCount.set(l.student_id!, (readerCount.get(l.student_id!) || 0) + 1));
  const topReaders = [...readerCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(today(), -7 * (7 - i)));
  const weekly = weeks.map((start) => ({ label: fmtDate(start, { day: 'numeric', month: 'short' }), Peminjaman: loans.filter((l) => l.borrowed_at >= start && l.borrowed_at < addDays(start, 7)).length }));
  const byCat = CATEGORIES.map((c) => ({ name: c, value: loans.filter((l) => d.books.find((b) => b.id === l.book_id)?.category === c).length })).filter((x) => x.value > 0);
  const collected = loans.filter((l) => l.fine_paid).reduce((a, l) => a + l.fine, 0);
  const members = new Set(loans.filter((l) => l.borrowed_at >= since).map((l) => (l.student_id ? `s${l.student_id}` : `e${l.employee_id}`))).size;
  const late = loans.filter((l) => !l.returned_at && l.due_date < today());

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Judul Buku" value={d.books.length} icon={Library} tone="blue" />
        <StatCard label="Total Eksemplar" value={d.books.reduce((a, b) => a + b.copies, 0)} icon={BookOpen} tone="violet" />
        <StatCard label="Peminjaman 30 Hari" value={loans.filter((l) => l.borrowed_at >= since).length} icon={ArrowRightLeft} tone="green" />
        <StatCard label="Peminjam Aktif (30 hari)" value={members} icon={Users} tone="amber" />
        <StatCard label="Denda Terkumpul" value={rupiah(collected)} icon={Wallet} tone="slate" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Peminjaman per Minggu" className="lg:col-span-2"><BarsChart data={weekly} bars={[{ key: 'Peminjaman', name: 'Peminjaman' }]} height={230} /></Card>
        {compact ? (
          <Card title={`Terlambat (${late.length})`} bodyClass="p-0 max-h-72 overflow-y-auto">
            <ul className="divide-y divide-slate-100">
              {late.map((l) => { const w = borrowerOf(l, d); return <li key={l.id} className="px-4 py-2.5 text-sm"><p className="font-medium">{w.name}</p><p className="text-xs text-slate-500">{d.books.find((b) => b.id === l.book_id)?.title} · {lateDays(l)} hari</p></li>; })}
            </ul>
            {!late.length && <Empty text="Tidak ada keterlambatan" />}
          </Card>
        ) : <Card title="Peminjaman per Kategori"><DonutChart data={byCat} /></Card>}
      </div>
      {!compact && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="Buku Terpopuler"><BarsChart data={topBooks} bars={[{ key: 'Peminjaman', name: 'Peminjaman' }]} layout="vertical" height={230} /></Card>
          <Card title="Pembaca Teraktif (Siswa)" bodyClass="p-0">
            <ul className="divide-y divide-slate-100">
              {topReaders.map(([sid, n], i) => { const s = d.students.find((x) => x.id === sid); return (
                <li key={sid} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-5 text-slate-400">{i + 1}</span><Avatar name={s?.name || '?'} className="h-7 w-7 text-[10px]" />
                  <span className="flex-1">{s?.name} <span className="text-slate-500">· {d.classes.find((c) => c.id === s?.class_id)?.name}</span></span>
                  <Badge tone="blue">{n} buku</Badge>
                </li>
              ); })}
            </ul>
          </Card>
        </div>
      )}
      {!compact && (
        <Button variant="secondary" className="mt-4" onClick={() => downloadCSV('riwayat-sirkulasi.csv', [['Tanggal Pinjam', 'Jatuh Tempo', 'Tanggal Kembali', 'Kode', 'Judul', 'Peminjam', 'Keterangan', 'Status', 'Denda', 'Denda Dibayar'], ...loans.map((l) => { const b = d.books.find((x) => x.id === l.book_id); const w = borrowerOf(l, d); return [l.borrowed_at, l.due_date, l.returned_at, b?.code, b?.title, w.name, w.sub, loanStatus(l), l.fine, l.fine_paid ? 'ya' : 'tidak']; })])}><Download className="h-4 w-4" /> Unduh Riwayat Sirkulasi (CSV)</Button>
      )}
    </>
  );
}

/* ================================ PENGATURAN ================================ */
export function LibrarySettings({ d }: { d: LibData }) {
  const cfg = d.settings[0];
  const [f, setF] = useState({ library_loan_days: cfg.library_loan_days, library_max_loans: cfg.library_max_loans, library_fine_per_day: cfg.library_fine_per_day });
  return (
    <Card title="Aturan Peminjaman" className="max-w-xl">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Lama Pinjam (hari)"><Input type="number" min={1} value={f.library_loan_days} onChange={(e) => setF({ ...f, library_loan_days: Number(e.target.value) })} /></Field>
        <Field label="Maks. Buku / Peminjam"><Input type="number" min={1} value={f.library_max_loans} onChange={(e) => setF({ ...f, library_max_loans: Number(e.target.value) })} /></Field>
        <Field label="Denda / Hari (Rp)"><Input type="number" min={0} step={100} value={f.library_fine_per_day} onChange={(e) => setF({ ...f, library_fine_per_day: Number(e.target.value) })} /></Field>
      </div>
      <p className="mt-3 text-xs text-slate-500">Perpanjangan diizinkan satu kali selama belum terlambat dan tidak ada reservasi dari peminjam lain. Peminjam dengan buku terlambat atau denda belum dibayar tidak dapat meminjam lagi.</p>
      <Button className="mt-4" onClick={() => run(() => api.action('library.settings', f), 'Pengaturan perpustakaan disimpan')}>Simpan</Button>
    </Card>
  );
}

/* ================================ PINJAMAN SAYA ================================ */
export function MyLoans({ d, who, canAct }: { d: LibData; who: { student_id?: number; employee_id?: number }; canAct: boolean }) {
  const cfg = d.settings[0];
  const mine = d.book_loans.filter((l) => (who.student_id ? l.student_id === who.student_id : l.employee_id === who.employee_id));
  const active = mine.filter((l) => !l.returned_at).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const history = mine.filter((l) => l.returned_at).sort((a, b) => (b.returned_at || '').localeCompare(a.returned_at || ''));
  const resv = d.book_reservations.filter((r) => r.status === 'menunggu' && (who.student_id ? r.student_id === who.student_id : r.employee_id === who.employee_id));
  const owed = mine.filter((l) => l.fine > 0 && !l.fine_paid).reduce((a, l) => a + l.fine, 0) + active.reduce((a, l) => a + loanFine(l, cfg.library_fine_per_day), 0);
  const book = (id: number) => d.books.find((b) => b.id === id)!;
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sedang Dipinjam" value={`${active.length}/${cfg.library_max_loans}`} icon={BookOpen} tone="blue" />
        <StatCard label="Terlambat" value={active.filter((l) => l.due_date < today()).length} icon={AlertTriangle} tone="red" />
        <StatCard label="Buku Dibaca" value={history.length} icon={BookCheck} tone="green" hint="sudah dikembalikan" />
        <StatCard label="Denda" value={rupiah(owed)} icon={Wallet} tone={owed ? 'red' : 'slate'} hint={`${rupiah(cfg.library_fine_per_day)}/hari keterlambatan`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Sedang Dipinjam" bodyClass="p-0">
          <div className="divide-y divide-slate-100">
            {active.map((l) => {
              const b = book(l.book_id);
              const late = l.due_date < today();
              return (
                <div key={l.id} className="flex gap-3 p-4">
                  <div className="w-14 shrink-0"><BookCover book={b} small /></div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold">{b.title}</p>
                    <p className="text-xs text-slate-500">{b.author} · dipinjam {fmtDate(l.borrowed_at)}</p>
                    <p className={cn('mt-1 font-medium', late ? 'text-red-600' : l.due_date <= addDays(today(), 2) ? 'text-amber-600' : 'text-slate-700')}>
                      {late ? `Terlambat ${lateDays(l)} hari · denda ${rupiah(loanFine(l, cfg.library_fine_per_day))}` : `Kembalikan paling lambat ${fmtDate(l.due_date, { weekday: 'long', day: 'numeric', month: 'long' })}`}
                    </p>
                    {canAct && !late && !l.extended && <Button size="sm" variant="secondary" className="mt-2" onClick={() => run(() => api.action('library.extend', { loan_id: l.id }), `Diperpanjang ${cfg.library_loan_days} hari`)}>Perpanjang {cfg.library_loan_days} hari</Button>}
                    {l.extended && <p className="text-xs text-slate-400">Sudah diperpanjang</p>}
                  </div>
                </div>
              );
            })}
          </div>
          {!active.length && <Empty text="Tidak ada buku yang sedang dipinjam" />}
        </Card>
        <Card title="Reservasi Saya" bodyClass="p-0">
          <div className="divide-y divide-slate-100">
            {resv.map((r) => {
              const b = book(r.book_id);
              const avail = availableCopies(b, d.book_loans);
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="flex-1"><p className="font-medium">{b.title}</p><p className="text-xs text-slate-500">Diajukan {fmtDateTime(r.created_at)}</p></div>
                  <Badge tone={avail > 0 ? 'green' : 'amber'}>{avail > 0 ? `Siap diambil · ${b.location}` : 'Menunggu buku kembali'}</Badge>
                  {canAct && <Button size="sm" variant="ghost" onClick={() => run(() => api.action('library.cancelReservation', { id: r.id }), 'Reservasi dibatalkan')}>Batal</Button>}
                </div>
              );
            })}
          </div>
          {!resv.length && <Empty text={canAct ? 'Belum ada reservasi. Cari buku di tab Katalog.' : 'Tidak ada reservasi'} />}
        </Card>
      </div>
      <Card title="Riwayat Peminjaman" className="mt-4" bodyClass="p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="px-4 py-2">Buku</th><th>Dipinjam</th><th>Dikembalikan</th><th className="pr-4">Keterangan</th></tr></thead>
          <tbody>
            {history.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="px-4 py-2 font-medium">{book(l.book_id).title}</td>
                <td>{fmtDate(l.borrowed_at)}</td>
                <td>{fmtDate(l.returned_at)}</td>
                <td className="pr-4">{l.fine ? <span className={l.fine_paid ? 'text-slate-500' : 'font-semibold text-red-600'}>Terlambat {lateDays(l)} hari · denda {rupiah(l.fine)} {l.fine_paid ? '(lunas)' : '(belum dibayar)'}{!l.fine_paid && l.bill_id && who.student_id && <Link href="/keuangan/tagihan/" className="ml-2 text-brand-600 underline">Bayar online</Link>}</span> : <Badge tone="green">Tepat waktu</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!history.length && <Empty />}
      </Card>
    </>
  );
}

/** Hook data perpustakaan. */
export function useLibraryData() {
  const { data } = useData([...LIB_KEYS]);
  return data as LibData | null;
}

export function useIsLibStaff() {
  const { user } = useAuth();
  return !!user && LIB_STAFF.includes(user.role);
}

