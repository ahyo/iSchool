'use client';
import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { api, useData } from '@/lib/api';
import { ROLE_LABEL, useAuth, useProfile } from '@/lib/auth';
import { Avatar, Badge, Button, Card, Field, Input, Loading, PageHeader, toast } from '@/components/ui';
import { fmtDate } from '@/lib/utils';

export default function ProfilPage() {
  const { user } = useAuth();
  const { employee, student, guardian, children } = useProfile();
  const { data } = useData(['units', 'classes']);
  const [f, setF] = useState({ old_password: '', new_password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  if (!user || !data) return <Loading />;
  const unitName = (id?: number | null) => data.units.find((u) => u.id === id)?.name || 'Yayasan';
  const className = (id?: number | null) => data.classes.find((c) => c.id === id)?.name || '-';

  const strength = (() => {
    const p = f.new_password;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.new_password.length < 6) return toast.error('Password baru minimal 6 karakter');
    if (f.new_password !== f.confirm) return toast.error('Konfirmasi password tidak sama');
    if (f.new_password === f.old_password) return toast.error('Password baru harus berbeda dari password lama');
    setBusy(true);
    try {
      await api.action('auth.changePassword', { old_password: f.old_password, new_password: f.new_password });
      toast.success('Password berhasil diubah');
      setF({ old_password: '', new_password: '', confirm: '' });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rows: [string, string][] = [['Username', user.username], ['Peran', ROLE_LABEL[user.role]]];
  if (employee) rows.push(['NIP', employee.nip], ['Jabatan', employee.position], ['Unit', unitName(employee.unit_id)], ['Status', employee.status], ['No. HP', employee.phone || '-'], ['Email', employee.email || '-'], ['Mulai Bertugas', fmtDate(employee.join_date)]);
  if (student && user.role === 'siswa') rows.push(['NIS / NISN', `${student.nis} / ${student.nisn}`], ['Kelas', className(student.class_id)], ['Unit', unitName(student.unit_id)], ['Tempat, Tgl Lahir', `${student.birth_place}, ${fmtDate(student.birth_date)}`], ['Alamat', student.address]);
  if (guardian) rows.push(['No. HP', guardian.phone], ['Email', guardian.email || '-'], ['Pekerjaan', guardian.occupation || '-'], ['Alamat', guardian.address], ['Anak', children.map((c) => `${c.name} (${className(c.class_id)})`).join(', ')]);

  return (
    <>
      <PageHeader title="Profil & Keamanan" subtitle="Data akun dan penggantian password" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profil Saya">
          <div className="mb-4 flex items-center gap-4">
            <Avatar name={user.name} className="h-14 w-14 text-lg" />
            <div><p className="text-lg font-bold">{user.name}</p><Badge tone="violet">{ROLE_LABEL[user.role]}</Badge></div>
          </div>
          <div className="text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-slate-100 py-2"><span className="text-slate-500">{k}</span><span className="text-right font-medium">{v}</span></div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Perubahan data diri dilakukan oleh bagian Tata Usaha/Kesiswaan.</p>
        </Card>
        <Card title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Ganti Password</span>}>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Password Lama" required><Input type="password" autoComplete="current-password" value={f.old_password} onChange={(e) => setF({ ...f, old_password: e.target.value })} required /></Field>
            <Field label="Password Baru" required hint="Minimal 6 karakter; disarankan kombinasi huruf besar, kecil, angka, dan simbol">
              <Input type="password" autoComplete="new-password" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} required />
            </Field>
            {f.new_password && (
              <div className="flex items-center gap-2 text-xs">
                <div className="flex flex-1 gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className={`h-1.5 flex-1 rounded ${i < strength ? (strength >= 3 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-200'}`} />)}</div>
                <span className="w-14 text-slate-500">{['Lemah', 'Lemah', 'Sedang', 'Kuat', 'Sangat kuat'][strength]}</span>
              </div>
            )}
            <Field label="Konfirmasi Password Baru" required><Input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required /></Field>
            <Button type="submit" loading={busy}><ShieldCheck className="h-4 w-4" /> Simpan Password</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
